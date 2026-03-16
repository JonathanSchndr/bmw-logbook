import type { Trip } from '~/types'

interface TripsResponse {
  trips: Trip[]
  total: number
  page: number
  limit: number
  pages: number
}

interface TripFilters {
  vin?: string
  year?: string | number
  month?: string | number
  purpose?: string
  page?: number
  limit?: number
}

export function useTrips() {
  const trips = ref<Trip[]>([])
  const total = ref(0)
  const pages = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTrips(filters: TripFilters = {}) {
    loading.value = true
    error.value = null
    try {
      const params: Record<string, string> = {}
      if (filters.vin) params.vin = filters.vin
      if (filters.year) params.year = String(filters.year)
      if (filters.month) params.month = String(filters.month)
      if (filters.purpose) params.purpose = filters.purpose
      if (filters.page) params.page = String(filters.page)
      if (filters.limit) params.limit = String(filters.limit)

      const result = await $fetch<TripsResponse>('/api/trips', { params })
      trips.value = result.trips
      total.value = result.total
      pages.value = result.pages
      return result
    } catch (err: any) {
      error.value = err.message || 'Failed to load trips'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateTrip(id: string, data: Partial<Trip>) {
    const updated = await $fetch<Trip>(`/api/trips/${id}`, {
      method: 'PATCH' as any,
      body: data,
    })
    const idx = trips.value.findIndex(t => t._id === id)
    if (idx !== -1) trips.value[idx] = updated
    return updated
  }

  async function deleteTrip(id: string) {
    await $fetch(`/api/trips/${id}`, { method: 'DELETE' as any as any })
    trips.value = trips.value.filter(t => t._id !== id)
    total.value--
  }

  async function createTrip(data: Partial<Trip>) {
    const trip = await $fetch<Trip>('/api/trips', {
      method: 'POST',
      body: data,
    })
    trips.value.unshift(trip)
    total.value++
    return trip
  }

  return {
    trips: readonly(trips),
    total: readonly(total),
    pages: readonly(pages),
    loading: readonly(loading),
    error: readonly(error),
    fetchTrips,
    updateTrip,
    deleteTrip,
    createTrip,
  }
}
