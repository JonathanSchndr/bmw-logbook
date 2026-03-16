import { TripModel } from '../models/Trip'
import { reverseGeocode } from './geocoder'

const TRIP_END_INACTIVITY_MS = 10 * 60 * 1000 // 10 minutes
const MIN_DISTANCE_M = 100 // 100 meters minimum movement
const MAX_WAYPOINTS = 500 // Limit waypoints per trip
// How long to wait after isMoving=false before ending the trip (tolerate brief stops)
const MOVING_STOP_GRACE_MS = 5 * 60 * 1000 // 5 minutes

interface VehicleState {
  lastLat: number | null
  lastLng: number | null
  lastMoveTime: Date | null
  currentTripId: string | null
  lastOdometer: number | null
  pendingLat: number | null
  pendingLng: number | null
  inactivityTimer: ReturnType<typeof setTimeout> | null
  movingStopTimer: ReturnType<typeof setTimeout> | null
}

const vehicleStates = new Map<string, VehicleState>()

function getState(vin: string): VehicleState {
  if (!vehicleStates.has(vin)) {
    vehicleStates.set(vin, {
      lastLat: null,
      lastLng: null,
      lastMoveTime: null,
      currentTripId: null,
      lastOdometer: null,
      pendingLat: null,
      pendingLng: null,
      inactivityTimer: null,
      movingStopTimer: null,
    })
  }
  return vehicleStates.get(vin)!
}

// Haversine formula - distance in meters
function haversineDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Haversine distance in km
function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineDistanceM(lat1, lng1, lat2, lng2) / 1000
}

async function endTrip(vin: string, state: VehicleState, endTime: Date): Promise<void> {
  if (!state.currentTripId) return

  try {
    const trip = await TripModel.findById(state.currentTripId)
    if (!trip) {
      state.currentTripId = null
      return
    }

    trip.endTime = endTime
    trip.status = 'completed'

    if (state.lastLat !== null && state.lastLng !== null) {
      trip.endLocation = { lat: state.lastLat, lng: state.lastLng }
      try {
        trip.endAddress = await reverseGeocode(state.lastLat, state.lastLng)
      } catch (_) {
        trip.endAddress = `${state.lastLat.toFixed(4)}, ${state.lastLng.toFixed(4)}`
      }
    }

    if (state.lastOdometer !== null) {
      trip.endOdometer = state.lastOdometer
      if (trip.startOdometer !== null) {
        trip.distanceKm = state.lastOdometer - trip.startOdometer
      }
    }

    // Calculate distance from waypoints if no odometer
    if (trip.distanceKm === 0 && trip.waypoints.length > 1) {
      let totalKm = 0
      for (let i = 1; i < trip.waypoints.length; i++) {
        const prev = trip.waypoints[i - 1]
        const curr = trip.waypoints[i]
        totalKm += haversineDistanceKm(prev.lat, prev.lng, curr.lat, curr.lng)
      }
      trip.distanceKm = Math.round(totalKm * 10) / 10
    }

    await trip.save()
    console.log(`[TripDetector] Trip ended for VIN ${vin}: ${trip._id}, distance: ${trip.distanceKm}km`)
  } catch (err) {
    console.error('[TripDetector] Error ending trip:', err)
  }

  state.currentTripId = null
  if (state.inactivityTimer) {
    clearTimeout(state.inactivityTimer)
    state.inactivityTimer = null
  }
  if (state.movingStopTimer) {
    clearTimeout(state.movingStopTimer)
    state.movingStopTimer = null
  }
}

function scheduleInactivityCheck(vin: string, state: VehicleState): void {
  if (state.inactivityTimer) {
    clearTimeout(state.inactivityTimer)
  }

  state.inactivityTimer = setTimeout(async () => {
    if (state.currentTripId && state.lastMoveTime) {
      const inactiveDuration = Date.now() - state.lastMoveTime.getTime()
      if (inactiveDuration >= TRIP_END_INACTIVITY_MS) {
        console.log(`[TripDetector] Inactivity timeout for VIN ${vin}, ending trip`)
        await endTrip(vin, state, state.lastMoveTime)
      }
    }
  }, TRIP_END_INACTIVITY_MS + 5000)
}

// Parse BMW boolean event values: "true", "false", "ASN_isTrue", "ASN_isFalse"
function parseBmwBool(value: string): boolean | null {
  const v = value.toLowerCase()
  if (v === 'true' || v === 'asn_istrue' || v === '1') return true
  if (v === 'false' || v === 'asn_isfalse' || v === '0') return false
  return null
}

async function startTripFromEvent(vin: string, state: VehicleState, timestamp: Date): Promise<void> {
  if (state.currentTripId) return
  try {
    const { SettingsModel } = await import('../models/Settings')
    const settings = await SettingsModel.findOne().lean()
    const driver = settings?.defaultDriver || ''
    const trip = new TripModel({
      vin,
      startTime: timestamp,
      startLocation: state.lastLat !== null && state.lastLng !== null
        ? { lat: state.lastLat, lng: state.lastLng }
        : undefined,
      status: 'in_progress',
      driver,
      waypoints: state.lastLat !== null && state.lastLng !== null
        ? [{ lat: state.lastLat, lng: state.lastLng, timestamp }]
        : [],
      startOdometer: state.lastOdometer,
    })
    if (state.lastLat !== null && state.lastLng !== null) {
      reverseGeocode(state.lastLat, state.lastLng)
        .then(addr => TripModel.findByIdAndUpdate(trip._id, { startAddress: addr }).exec())
        .catch(() => {})
    }
    await trip.save()
    state.currentTripId = trip._id.toString()
    console.log(`[TripDetector] Trip started (engine/movement event) for VIN ${vin}: ${trip._id}`)
  } catch (err) {
    console.error('[TripDetector] Error creating trip from engine event:', err)
  }
}

export async function processEvent(
  vin: string,
  eventName: string,
  value: string,
  timestamp: Date,
): Promise<void> {
  const state = getState(vin)

  // --- Engine / ignition events ---
  const isEngineEvent =
    eventName === 'vehicle.drivetrain.engine.isIgnitionOn' ||
    eventName === 'vehicle.drivetrain.engine.isActive'

  if (isEngineEvent) {
    const on = parseBmwBool(value)
    console.log(`[TripDetector] Engine event: ${eventName} = ${value} → parsed: ${on}`)
    if (on === true) {
      if (!state.currentTripId) {
        await startTripFromEvent(vin, state, timestamp)
      }
      // Cancel any pending stop timer
      if (state.movingStopTimer) {
        clearTimeout(state.movingStopTimer)
        state.movingStopTimer = null
      }
    } else if (on === false) {
      if (state.currentTripId) {
        console.log(`[TripDetector] Engine off for VIN ${vin}, ending trip`)
        await endTrip(vin, state, timestamp)
      }
    }
    return
  }

  // --- isMoving event ---
  if (eventName === 'vehicle.isMoving') {
    const moving = parseBmwBool(value)
    console.log(`[TripDetector] isMoving event: ${value} → parsed: ${moving}`)
    if (moving === true) {
      if (!state.currentTripId) {
        await startTripFromEvent(vin, state, timestamp)
      }
      // Cancel any pending stop timer
      if (state.movingStopTimer) {
        clearTimeout(state.movingStopTimer)
        state.movingStopTimer = null
      }
    } else if (moving === false) {
      if (state.currentTripId && !state.movingStopTimer) {
        console.log(`[TripDetector] isMoving=false for VIN ${vin}, will end trip in ${MOVING_STOP_GRACE_MS / 60000} min if still stopped`)
        state.movingStopTimer = setTimeout(async () => {
          state.movingStopTimer = null
          if (state.currentTripId) {
            console.log(`[TripDetector] Grace period elapsed, ending trip for VIN ${vin}`)
            await endTrip(vin, state, timestamp)
          }
        }, MOVING_STOP_GRACE_MS)
      }
    }
    return
  }

  // Handle odometer/mileage events
  if (
    eventName === 'vehicle.vehicle.travelledDistance' ||
    eventName.toLowerCase().includes('odometer') ||
    eventName.toLowerCase().includes('mileage') ||
    eventName.toLowerCase().includes('milage')
  ) {
    const odometerVal = parseFloat(value)
    if (!isNaN(odometerVal)) {
      state.lastOdometer = odometerVal
    }
    return
  }

  // Handle location events
  const isLat =
    eventName === 'vehicle.cabin.infotainment.navigation.currentLocation.latitude' ||
    eventName.toLowerCase().includes('latitude')
  const isLng =
    eventName === 'vehicle.cabin.infotainment.navigation.currentLocation.longitude' ||
    eventName.toLowerCase().includes('longitude')

  if (!isLat && !isLng) return

  const coordVal = parseFloat(value)
  if (isNaN(coordVal)) return

  if (isLat) state.pendingLat = coordVal
  if (isLng) state.pendingLng = coordVal

  // Need both coordinates
  if (state.pendingLat === null || state.pendingLng === null) return

  const currentLat = state.pendingLat
  const currentLng = state.pendingLng

  // Check movement distance
  let distanceMoved = 0
  if (state.lastLat !== null && state.lastLng !== null) {
    distanceMoved = haversineDistanceM(state.lastLat, state.lastLng, currentLat, currentLng)
  }

  const hasMovedEnough = distanceMoved >= MIN_DISTANCE_M || (state.lastLat === null && state.lastLng === null)

  if (hasMovedEnough || state.lastLat === null) {
    state.lastMoveTime = timestamp

    // Start a new trip if none active
    if (!state.currentTripId && (distanceMoved >= MIN_DISTANCE_M || state.lastLat === null)) {
      if (distanceMoved >= MIN_DISTANCE_M) {
        try {
          // Get default driver from settings
          const { SettingsModel } = await import('../models/Settings')
          const settings = await SettingsModel.findOne().lean()
          const driver = settings?.defaultDriver || ''

          const trip = new TripModel({
            vin,
            startTime: timestamp,
            startLocation: { lat: currentLat, lng: currentLng },
            status: 'in_progress',
            driver,
            waypoints: [{ lat: currentLat, lng: currentLng, timestamp }],
            startOdometer: state.lastOdometer,
          })

          // Geocode start address in background
          reverseGeocode(currentLat, currentLng)
            .then((addr) => {
              TripModel.findByIdAndUpdate(trip._id, { startAddress: addr }).exec()
            })
            .catch(() => {})

          await trip.save()
          state.currentTripId = trip._id.toString()
          console.log(`[TripDetector] New trip started for VIN ${vin}: ${trip._id}`)
        } catch (err) {
          console.error('[TripDetector] Error creating trip:', err)
        }
      }
    } else if (state.currentTripId) {
      // Update existing trip with new waypoint
      try {
        const trip = await TripModel.findById(state.currentTripId)
        if (trip) {
          if (trip.waypoints.length < MAX_WAYPOINTS) {
            trip.waypoints.push({ lat: currentLat, lng: currentLng, timestamp })
          }

          // Update distance from waypoints
          if (trip.waypoints.length > 1) {
            let totalKm = 0
            for (let i = 1; i < trip.waypoints.length; i++) {
              const prev = trip.waypoints[i - 1]
              const curr = trip.waypoints[i]
              totalKm += haversineDistanceKm(prev.lat, prev.lng, curr.lat, curr.lng)
            }
            trip.distanceKm = Math.round(totalKm * 10) / 10
          }

          await trip.save()
        } else {
          // Trip was deleted externally
          state.currentTripId = null
        }
      } catch (err) {
        console.error('[TripDetector] Error updating trip waypoint:', err)
      }
    }

    state.lastLat = currentLat
    state.lastLng = currentLng

    // Schedule inactivity check
    if (state.currentTripId) {
      scheduleInactivityCheck(vin, state)
    }
  }
}

export function getVehicleState(vin: string): VehicleState {
  return getState(vin)
}

export function resetVehicleState(vin: string): void {
  const state = getState(vin)
  if (state.inactivityTimer) clearTimeout(state.inactivityTimer)
  if (state.movingStopTimer) clearTimeout(state.movingStopTimer)
  vehicleStates.delete(vin)
}
