import type { Vehicle } from '~/types'

export function useVehicles() {
  const vehicles = ref<Vehicle[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchVehicles() {
    loading.value = true
    error.value = null
    try {
      vehicles.value = await $fetch<Vehicle[]>('/api/vehicles')
    } catch (err: any) {
      error.value = err.message || 'Failed to load vehicles'
    } finally {
      loading.value = false
    }
  }

  async function addVehicle(data: Partial<Vehicle>) {
    const vehicle = await $fetch<Vehicle>('/api/vehicles', {
      method: 'POST',
      body: data,
    })
    vehicles.value.unshift(vehicle)
    return vehicle
  }

  async function updateVehicle(vin: string, data: Partial<Vehicle>) {
    const updated = await $fetch<Vehicle>(`/api/vehicles/${vin}`, {
      method: 'PATCH' as any,
      body: data,
    })
    const idx = vehicles.value.findIndex(v => v.vin === vin)
    if (idx !== -1) vehicles.value[idx] = updated
    return updated
  }

  async function deleteVehicle(vin: string) {
    await $fetch(`/api/vehicles/${vin}`, { method: 'DELETE' as any })
    vehicles.value = vehicles.value.filter(v => v.vin !== vin)
  }

  return {
    vehicles: readonly(vehicles),
    loading: readonly(loading),
    error: readonly(error),
    fetchVehicles,
    addVehicle,
    updateVehicle,
    deleteVehicle,
  }
}
