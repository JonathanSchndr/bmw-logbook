// Nominatim (OpenStreetMap) reverse geocoder
// Rate limit: 1 request per second

const cache = new Map<string, string>()
let lastRequestTime = 0
const MIN_INTERVAL_MS = 1100 // 1.1 seconds between requests

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`

  if (cache.has(key)) {
    return cache.get(key)!
  }

  // Rate limiting
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - elapsed)
  }

  lastRequestTime = Date.now()

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'bmw-logbook/1.0',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status}`)
    }

    const data = await response.json() as any

    let address = ''
    if (data.address) {
      const parts: string[] = []
      const a = data.address

      if (a.road) {
        parts.push(a.house_number ? `${a.road} ${a.house_number}` : a.road)
      }
      if (a.postcode && (a.city || a.town || a.village || a.suburb)) {
        parts.push(`${a.postcode} ${a.city || a.town || a.village || a.suburb}`)
      } else if (a.city || a.town || a.village) {
        parts.push(a.city || a.town || a.village)
      }

      address = parts.join(', ')
    }

    if (!address) {
      address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }

    cache.set(key, address)
    return address
  } catch (err) {
    console.error('[Geocoder] Error reverse geocoding:', err)
    const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    cache.set(key, fallback)
    return fallback
  }
}

export function clearGeocodeCache(): void {
  cache.clear()
}
