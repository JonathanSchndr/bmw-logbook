import { connectDB } from '../../../utils/db'
import { TripModel } from '../../../models/Trip'

function sampleWaypoints(waypoints: { lat: number; lng: number }[], maxCount: number) {
  if (waypoints.length <= maxCount) return waypoints
  const step = (waypoints.length - 1) / (maxCount - 1)
  return Array.from({ length: maxCount }, (_, i) => waypoints[Math.round(i * step)]!)
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Trip ID required' })

  await connectDB()
  const trip = await TripModel.findById(id).select('waypoints startLocation endLocation').lean()
  if (!trip) throw createError({ statusCode: 404, message: 'Trip not found' })

  const gpsPoints = trip.waypoints?.length > 1
    ? trip.waypoints
    : [trip.startLocation, trip.endLocation].filter(Boolean) as { lat: number; lng: number }[]

  if (gpsPoints.length < 2) {
    throw createError({ statusCode: 422, message: 'Not enough waypoints to route' })
  }

  // Deduplicate consecutive identical coordinates (parked GPS noise → OSRM 400)
  const deduped = gpsPoints.filter((p, i) =>
    i === 0 || p.lat !== gpsPoints[i - 1]!.lat || p.lng !== gpsPoints[i - 1]!.lng,
  )
  if (deduped.length < 2) {
    throw createError({ statusCode: 422, message: 'Not enough distinct waypoints to route' })
  }

  // Sample to max 50 points — more points = better map-matching result
  const sampled = sampleWaypoints(deduped, 50)
  const coords = sampled.map(p => `${p.lng},${p.lat}`).join(';')

  // Use OSRM map-matching API — snaps GPS trace to roads using HMM
  // tidy=true removes outlier points automatically
  const url = `https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson&tidy=true`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'bmw-logbook/1.0', Accept: 'application/json' },
  })

  if (response.ok) {
    const data = await response.json() as any
    if (data.code === 'Ok' && data.matchings?.length) {
      // Merge all matching segments (can be multiple if GPS trace has gaps)
      const allCoords: [number, number][] = []
      let totalDistance = 0
      for (const matching of data.matchings) {
        allCoords.push(...(matching.geometry.coordinates as [number, number][]))
        totalDistance += matching.distance
      }
      return {
        distanceKm: Math.round((totalDistance / 1000) * 10) / 10,
        waypoints: allCoords.map(([lng, lat]) => ({ lat, lng })),
      }
    }
  }

  // Fallback: route directly from first to last point via OSRM route API
  const first = gpsPoints[0]!
  const last = gpsPoints[gpsPoints.length - 1]!
  const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${first.lng},${first.lat};${last.lng},${last.lat}?overview=full&geometries=geojson`
  const fallbackRes = await fetch(fallbackUrl, {
    headers: { 'User-Agent': 'bmw-logbook/1.0', Accept: 'application/json' },
  })
  if (!fallbackRes.ok) throw createError({ statusCode: 502, message: 'Routing service unavailable' })
  const fallbackData = await fallbackRes.json() as any
  if (!fallbackData.routes?.length) throw createError({ statusCode: 404, message: 'No route found' })
  const route = fallbackData.routes[0]
  return {
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    waypoints: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng })),
  }
})
