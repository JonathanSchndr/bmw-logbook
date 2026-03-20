import { TripModel } from '../models/Trip'
import { reverseGeocode } from './geocoder'

const TRIP_END_INACTIVITY_MS = 5 * 60 * 1000 // 5 minutes without GPS → trip ends
const MIN_DISTANCE_M = 10 // 10 meters minimum to detect movement
const MAX_WAYPOINTS = 2000 // max waypoints per trip

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

// Per-VIN mutex: prevents two concurrent GPS events from both creating a trip
const creatingTrip = new Set<string>()

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

function sampleWaypoints(waypoints: { lat: number; lng: number }[], maxCount: number) {
  if (waypoints.length <= maxCount) return waypoints
  const step = (waypoints.length - 1) / (maxCount - 1)
  return Array.from({ length: maxCount }, (_, i) => waypoints[Math.round(i * step)]!)
}

async function refineDistanceFromOsrm(tripId: string, waypoints: { lat: number; lng: number }[]): Promise<void> {
  try {
    // Remove consecutive duplicate coordinates (parked car GPS noise causes OSRM 400)
    const deduped = waypoints.filter((p, i) =>
      i === 0 || p.lat !== waypoints[i - 1]!.lat || p.lng !== waypoints[i - 1]!.lng,
    )
    if (deduped.length < 2) return
    const sampled = sampleWaypoints(deduped, 50)
    const coords = sampled.map(p => `${p.lng},${p.lat}`).join(';')
    const url = `https://router.project-osrm.org/match/v1/driving/${coords}?overview=false&tidy=true`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'bmw-logbook/1.0', Accept: 'application/json' },
    })
    if (!response.ok) {
      console.warn(`[TripDetector] OSRM match returned ${response.status}, keeping GPS distance`)
      return
    }
    const data = await response.json() as any
    if (data.code !== 'Ok' || !data.matchings?.length) return
    const totalDistance = data.matchings.reduce((sum: number, m: any) => sum + m.distance, 0)
    const distanceKm = Math.round((totalDistance / 1000) * 10) / 10
    await TripModel.findByIdAndUpdate(tripId, { distanceKm })
    console.log(`[TripDetector] OSRM road distance for trip ${tripId}: ${distanceKm}km`)
  } catch (err) {
    console.error('[TripDetector] OSRM distance refinement failed:', err)
  }
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
        const prev = trip.waypoints[i - 1]!
        const curr = trip.waypoints[i]!
        totalKm += haversineDistanceKm(prev.lat, prev.lng, curr.lat, curr.lng)
      }
      trip.distanceKm = Math.round(totalKm * 10) / 10
    }

    await trip.save()
    console.log(`[TripDetector] Trip ended for VIN ${vin}: ${trip._id}, distance: ${trip.distanceKm}km`)

    // Refine distance using OSRM road distance in background
    if (trip.waypoints.length > 1) {
      refineDistanceFromOsrm(trip._id.toString(), trip.waypoints as { lat: number; lng: number }[])
    }
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
  }, TRIP_END_INACTIVITY_MS)
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

  // Need both lat + lng before processing
  if (state.pendingLat === null || state.pendingLng === null) return

  const currentLat = state.pendingLat
  const currentLng = state.pendingLng

  // First position ever — just store it, no trip yet
  if (state.lastLat === null || state.lastLng === null) {
    state.lastLat = currentLat
    state.lastLng = currentLng
    console.log(`[TripDetector] First GPS position for VIN ${vin}: ${currentLat}, ${currentLng}`)
    return
  }

  const distanceMoved = haversineDistanceM(state.lastLat, state.lastLng, currentLat, currentLng)

  // Ignore duplicate / near-duplicate positions (GPS noise < 10m)
  if (distanceMoved < MIN_DISTANCE_M) return

  // Vehicle is moving — update last known position and time
  state.lastMoveTime = timestamp
  state.lastLat = currentLat
  state.lastLng = currentLng

  if (!state.currentTripId && !creatingTrip.has(vin)) {
    // Start a new trip on first real movement
    creatingTrip.add(vin)
    try {
      const { SettingsModel } = await import('../models/Settings')
      const settings = await SettingsModel.findOne().lean()
      const driver = (settings as any)?.defaultDriver || ''

      const trip = new TripModel({
        vin,
        startTime: timestamp,
        startLocation: { lat: currentLat, lng: currentLng },
        status: 'in_progress',
        driver,
        waypoints: [{ lat: currentLat, lng: currentLng, timestamp }],
        startOdometer: state.lastOdometer,
      })

      reverseGeocode(currentLat, currentLng)
        .then(addr => TripModel.findByIdAndUpdate(trip._id, { startAddress: addr }).exec())
        .catch(() => {})

      await trip.save()
      state.currentTripId = trip._id.toString()
      console.log(`[TripDetector] Trip started for VIN ${vin}: ${trip._id}`)
    } catch (err) {
      console.error('[TripDetector] Error creating trip:', err)
    } finally {
      creatingTrip.delete(vin)
    }
  } else if (state.currentTripId) {
    // Add every GPS point as waypoint during active trip
    try {
      const trip = await TripModel.findById(state.currentTripId)
      if (trip) {
        if (trip.waypoints.length < MAX_WAYPOINTS) {
          trip.waypoints.push({ lat: currentLat, lng: currentLng, timestamp })
        }
        // Incrementally add last segment distance (faster than recalculating all waypoints)
        const prev = trip.waypoints[trip.waypoints.length - 2]
        const curr = trip.waypoints[trip.waypoints.length - 1]
        if (prev && curr) {
          trip.distanceKm = Math.round(
            ((trip.distanceKm || 0) + haversineDistanceKm(prev.lat, prev.lng, curr.lat, curr.lng)) * 10,
          ) / 10
        }
        await trip.save()
      } else {
        state.currentTripId = null
      }
    } catch (err) {
      console.error('[TripDetector] Error updating trip waypoint:', err)
    }
  }

  // (Re)schedule the 5-min inactivity check on every GPS update
  if (state.currentTripId) {
    scheduleInactivityCheck(vin, state)
  }
}

export function getVehicleState(vin: string): VehicleState {
  return getState(vin)
}

export function resetVehicleState(vin: string): void {
  const state = getState(vin)
  if (state.inactivityTimer) clearTimeout(state.inactivityTimer)
  vehicleStates.delete(vin)
}
