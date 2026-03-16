import { TripModel } from '../models/Trip'
import { reverseGeocode } from './geocoder'

const TRIP_END_INACTIVITY_MS = 10 * 60 * 1000 // 10 minutes
const MIN_DISTANCE_M = 100 // 100 meters minimum movement
const MAX_WAYPOINTS = 500 // Limit waypoints per trip

interface VehicleState {
  lastLat: number | null
  lastLng: number | null
  lastMoveTime: Date | null
  currentTripId: string | null
  lastOdometer: number | null
  pendingLat: number | null
  pendingLng: number | null
  inactivityTimer: ReturnType<typeof setTimeout> | null
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

export async function processEvent(
  vin: string,
  eventName: string,
  value: string,
  timestamp: Date,
): Promise<void> {
  const state = getState(vin)

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
  if (state.inactivityTimer) {
    clearTimeout(state.inactivityTimer)
  }
  vehicleStates.delete(vin)
}
