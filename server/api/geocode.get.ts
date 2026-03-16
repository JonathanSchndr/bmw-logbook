export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q || '').trim()
  const limit = Math.min(parseInt(String(query.limit || '1')), 10)

  if (!q) throw createError({ statusCode: 400, message: 'q parameter required' })

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${limit}&addressdetails=1`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'bmw-logbook/1.0', Accept: 'application/json' },
  })

  if (!response.ok) throw createError({ statusCode: 502, message: 'Geocoding service unavailable' })

  const data = await response.json() as any[]

  if (limit === 1) {
    if (!data.length) return { found: false, lat: null, lng: null }
    return {
      found: true,
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name as string,
    }
  }

  return data.map((item: any) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name as string,
    shortName: formatShortName(item),
  }))
})

function formatShortName(item: any): string {
  const a = item.address || {}
  const parts: string[] = []
  if (a.road) parts.push(a.house_number ? `${a.road} ${a.house_number}` : a.road)
  const city = a.city || a.town || a.village || a.suburb || a.county
  if (a.postcode && city) parts.push(`${a.postcode} ${city}`)
  else if (city) parts.push(city)
  if (a.country_code && a.country_code !== 'de') parts.push(a.country || '')
  return parts.join(', ') || item.display_name
}
