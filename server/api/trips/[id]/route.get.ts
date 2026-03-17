import { connectDB } from '../../../utils/db'
import { TripModel } from '../../../models/Trip'

// Sample waypoints evenly down to maxCount to avoid OSRM URL limits
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

  // Sample to max 25 points for OSRM
  const sampled = sampleWaypoints(gpsPoints, 25)

  const coords = sampled.map(p => `${p.lng},${p.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'bmw-logbook/1.0', Accept: 'application/json' },
  })

  if (!response.ok) throw createError({ statusCode: 502, message: 'Routing service unavailable' })

  const data = await response.json() as any
  if (!data.routes?.length) throw createError({ statusCode: 404, message: 'No route found' })

  const route = data.routes[0]
  const routeCoords: [number, number][] = route.geometry.coordinates // [lng, lat]

  return {
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    waypoints: routeCoords.map(([lng, lat]) => ({ lat, lng })),
  }
})
