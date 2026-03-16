export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const fromLat = parseFloat(String(query.fromLat))
  const fromLng = parseFloat(String(query.fromLng))
  const toLat = parseFloat(String(query.toLat))
  const toLng = parseFloat(String(query.toLng))

  if ([fromLat, fromLng, toLat, toLng].some(isNaN)) {
    throw createError({ statusCode: 400, message: 'fromLat, fromLng, toLat, toLng required' })
  }

  // OSRM public demo server — driving profile, full geometry as polyline6
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'bmw-logbook/1.0', Accept: 'application/json' },
  })

  if (!response.ok) throw createError({ statusCode: 502, message: 'Routing service unavailable' })

  const data = await response.json() as any

  if (!data.routes?.length) {
    throw createError({ statusCode: 404, message: 'No route found' })
  }

  const route = data.routes[0]
  const coords: [number, number][] = route.geometry.coordinates // [lng, lat] pairs

  return {
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    durationSec: Math.round(route.duration),
    waypoints: coords.map(([lng, lat]) => ({ lat, lng })),
  }
})
