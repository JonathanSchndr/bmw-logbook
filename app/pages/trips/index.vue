<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Trips</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ total }} trip{{ total !== 1 ? 's' : '' }} found
        </p>
      </div>
      <div class="flex items-center gap-3">
        <UButton icon="i-heroicons-plus" size="sm" @click="showAddModal = true">
          Add manual trip
        </UButton>
        <UButton icon="i-heroicons-arrow-down-tray" variant="outline" size="sm" @click="navigateTo('/export')">
          Export
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <UCard>
      <div class="flex flex-wrap gap-3">
        <USelectMenu
          v-model="filters.vin"
          :items="vehicleOptions"
          value-key="value"
          placeholder="All vehicles"
          size="sm"
          class="w-44"
        />
        <USelectMenu
          v-model="filters.year"
          :items="yearOptions"
          value-key="value"
          placeholder="Year"
          size="sm"
          class="w-28"
        />
        <USelectMenu
          v-model="filters.month"
          :items="monthOptions"
          value-key="value"
          placeholder="Month"
          size="sm"
          class="w-32"
        />
        <USelectMenu
          v-model="filters.purpose"
          :items="purposeOptions"
          value-key="value"
          placeholder="Purpose"
          size="sm"
          class="w-40"
        />
        <UButton
          v-if="hasActiveFilters"
          variant="ghost"
          size="sm"
          icon="i-heroicons-x-mark"
          @click="clearFilters"
        >
          Clear filters
        </UButton>
      </div>
    </UCard>

    <!-- Bulk actions -->
    <div v-if="selectedTripIds.size > 0" class="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
      <span class="text-sm font-medium text-blue-700 dark:text-blue-300">
        {{ selectedTripIds.size }} trip{{ selectedTripIds.size !== 1 ? 's' : '' }} selected
      </span>
      <USelectMenu
        v-model="bulkPurpose"
        :items="purposeOptions.slice(1)"
        placeholder="Classify as..."
        size="sm"
        class="w-44"
      />
      <UButton size="sm" :disabled="!bulkPurpose" @click="applyBulkClassify">
        Apply
      </UButton>
      <UButton color="error" variant="soft" size="sm" icon="i-heroicons-trash" :loading="deletingBulk" @click="deleteBulk">
        Delete
      </UButton>
      <UButton variant="ghost" size="sm" @click="selectedTripIds.clear()">
        Deselect all
      </UButton>
    </div>

    <!-- Trips List -->
    <div v-if="loading" class="space-y-3">
      <USkeleton v-for="i in 5" :key="i" class="h-20 rounded-lg" />
    </div>

    <div
      v-else-if="trips.length === 0"
      class="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800"
    >
      <UIcon name="i-heroicons-map" class="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
      <p class="text-gray-500 dark:text-gray-400">No trips match the selected filters</p>
    </div>

    <div v-else class="space-y-2">
      <div v-for="trip in trips" :key="trip._id" class="relative">
        <div class="absolute left-3 top-3 z-10">
          <UCheckbox
            :model-value="selectedTripIds.has(trip._id!)"
            @update:model-value="(v) => toggleSelect(trip._id!, v)"
            @click.stop
          />
        </div>
        <div class="pl-10 pr-10">
          <TripCard
            :trip="trip"
            show-classify
            @click="navigateTo(`/trips/${trip._id}`)"
            @classify="(id, purpose) => classifyTrip(id, purpose)"
          />
        </div>
        <div class="absolute right-3 top-3 z-10">
          <UButton
            color="error"
            variant="ghost"
            icon="i-heroicons-trash"
            size="xs"
            @click.stop="deleteTrip(trip._id!)"
          />
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pages > 1" class="flex justify-center">
      <UPagination v-model="currentPage" :total="total" :page-count="perPage" :max="7" />
    </div>

    <!-- Add Trip Modal -->
    <UModal v-model:open="showAddModal" scrollable>
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Add manual trip</h3>
          </template>

          <form class="space-y-4" @submit.prevent="submitAddTrip">
            <UFormField label="Vehicle" required class="w-full">
              <USelectMenu v-model="newTrip.vin" :items="vehicleOptionsRequired" value-key="value" placeholder="Select vehicle" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Start time" required class="w-full">
                <UInput v-model="newTrip.startTime" type="datetime-local" class="w-full" />
              </UFormField>
              <UFormField label="End time" class="w-full">
                <UInput v-model="newTrip.endTime" type="datetime-local" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Departure address" class="w-full">
              <AddressAutocomplete v-model="newTrip.startAddress" placeholder="123 Main St, Munich" />
            </UFormField>
            <UFormField label="Destination address" class="w-full">
              <AddressAutocomplete v-model="newTrip.endAddress" placeholder="Destination address" />
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Distance (km)" class="w-full">
                <div class="flex gap-2">
                  <UInput v-model="newTrip.distanceKm" type="number" step="0.1" placeholder="0.0" class="w-full" />
                  <UButton
                    type="button"
                    variant="outline"
                    size="sm"
                    icon="i-heroicons-calculator"
                    :loading="calculatingDistance"
                    :disabled="!newTrip.startAddress || !newTrip.endAddress"
                    title="Calculate distance from addresses"
                    @click="calculateDistance"
                  />
                </div>
              </UFormField>
              <UFormField label="Purpose" class="w-full">
                <USelectMenu v-model="newTrip.purpose" :items="purposeOptions.slice(1)" value-key="value" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Driver" class="w-full">
              <UInput v-model="newTrip.driver" placeholder="John Doe" class="w-full" />
            </UFormField>
            <UFormField label="Notes" class="w-full">
              <UTextarea v-model="newTrip.notes" placeholder="Optional notes" :rows="2" class="w-full" />
            </UFormField>
          </form>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" @click="showAddModal = false">Cancel</UButton>
              <UButton :loading="addingTrip" @click="submitAddTrip">Add trip</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Trip, Vehicle } from '~/types'

const toast = useToast()

const { data: vehicles } = await useFetch<Vehicle[]>('/api/vehicles')
const vehicleOptions = computed(() => [
  { label: 'All vehicles', value: undefined },
  ...(vehicles.value || []).map(v => ({
    label: `${v.licensePlate || v.vin} (${v.make} ${v.model})`,
    value: v.vin,
  })),
])
const vehicleOptionsRequired = computed(() =>
  (vehicles.value || []).map(v => ({
    label: `${v.licensePlate || v.vin} (${v.make} ${v.model})`,
    value: v.vin,
  })),
)

const currentYear = new Date().getFullYear()
const filters = reactive({
  vin: undefined as string | undefined,
  year: String(currentYear),
  month: undefined as string | undefined,
  purpose: undefined as string | undefined,
})

const yearOptions = Array.from({ length: 5 }, (_, i) => ({
  label: String(currentYear - i),
  value: String(currentYear - i),
}))

const monthOptions = [
  { label: 'All months', value: undefined },
  { label: 'January', value: '1' },
  { label: 'February', value: '2' },
  { label: 'March', value: '3' },
  { label: 'April', value: '4' },
  { label: 'May', value: '5' },
  { label: 'June', value: '6' },
  { label: 'July', value: '7' },
  { label: 'August', value: '8' },
  { label: 'September', value: '9' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
]

const purposeOptions = [
  { label: 'All purposes', value: undefined },
  { label: 'Business', value: 'business' },
  { label: 'Private', value: 'private' },
  { label: 'Unclassified', value: 'unclassified' },
]

const hasActiveFilters = computed(() =>
  filters.vin || filters.month || filters.purpose || filters.year !== String(currentYear),
)

function clearFilters() {
  filters.vin = undefined
  filters.month = undefined
  filters.purpose = undefined
  filters.year = String(currentYear)
}

const currentPage = ref(1)
const perPage = 20
const trips = ref<Trip[]>([])
const total = ref(0)
const pages = ref(0)
const loading = ref(false)

async function loadTrips() {
  loading.value = true
  try {
    const params: Record<string, string> = {
      page: String(currentPage.value),
      limit: String(perPage),
    }
    if (filters.vin) params.vin = filters.vin
    if (filters.year) params.year = filters.year
    if (filters.month) params.month = filters.month
    if (filters.purpose) params.purpose = filters.purpose

    const result = await $fetch<{ trips: Trip[]; total: number; pages: number }>('/api/trips', { params })
    trips.value = result.trips
    total.value = result.total
    pages.value = result.pages
  } finally {
    loading.value = false
  }
}

await loadTrips()

watch([filters, currentPage], () => {
  loadTrips()
}, { deep: true })

const selectedTripIds = reactive(new Set<string>())
const bulkPurpose = ref<string | undefined>(undefined)

function toggleSelect(id: string, selected: boolean) {
  if (selected) selectedTripIds.add(id)
  else selectedTripIds.delete(id)
}

async function applyBulkClassify() {
  if (!bulkPurpose.value || selectedTripIds.size === 0) return
  try {
    await Promise.all(
      [...selectedTripIds].map(id =>
        $fetch(`/api/trips/${id}`, { method: 'PATCH' as any, body: { purpose: bulkPurpose.value } }),
      ),
    )
    toast.add({ title: `${selectedTripIds.size} trips classified`, color: 'green' })
    selectedTripIds.clear()
    bulkPurpose.value = undefined
    await loadTrips()
  } catch {
    toast.add({ title: 'Failed to classify trips', color: 'red' })
  }
}

async function classifyTrip(id: string, purpose: string) {
  try {
    await $fetch(`/api/trips/${id}`, { method: 'PATCH' as any, body: { purpose } })
    const idx = trips.value.findIndex(t => t._id === id)
    if (idx !== -1) trips.value[idx].purpose = purpose as any
    toast.add({ title: 'Trip classified', color: 'green' })
  } catch {
    toast.add({ title: 'Failed to classify trip', color: 'red' })
  }
}

async function deleteTrip(id: string) {
  try {
    await $fetch(`/api/trips/${id}`, { method: 'DELETE' as any })
    trips.value = trips.value.filter(t => t._id !== id)
    total.value--
    selectedTripIds.delete(id)
    toast.add({ title: 'Trip deleted', color: 'green' })
  } catch {
    toast.add({ title: 'Failed to delete trip', color: 'red' })
  }
}

const deletingBulk = ref(false)

async function deleteBulk() {
  if (selectedTripIds.size === 0) return
  deletingBulk.value = true
  try {
    await Promise.all([...selectedTripIds].map(id => $fetch(`/api/trips/${id}`, { method: 'DELETE' as any })))
    toast.add({ title: `${selectedTripIds.size} trips deleted`, color: 'green' })
    selectedTripIds.clear()
    await loadTrips()
  } catch {
    toast.add({ title: 'Failed to delete trips', color: 'red' })
  } finally {
    deletingBulk.value = false
  }
}

const showAddModal = ref(false)
const addingTrip = ref(false)
const calculatingDistance = ref(false)

async function calculateDistance() {
  if (!newTrip.startAddress || !newTrip.endAddress) return
  calculatingDistance.value = true
  try {
    const [from, to] = await Promise.all([
      $fetch<{ found: boolean; lat: number | null; lng: number | null }>(`/api/geocode?q=${encodeURIComponent(newTrip.startAddress)}`),
      $fetch<{ found: boolean; lat: number | null; lng: number | null }>(`/api/geocode?q=${encodeURIComponent(newTrip.endAddress)}`),
    ])
    if (from.found && to.found && from.lat && from.lng && to.lat && to.lng) {
      const route = await $fetch<{ distanceKm: number }>(
        `/api/route?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}`,
      )
      newTrip.distanceKm = String(route.distanceKm)
    } else {
      toast.add({ title: 'Could not geocode one or both addresses', color: 'yellow' })
    }
  } catch {
    toast.add({ title: 'Distance calculation failed', color: 'red' })
  } finally {
    calculatingDistance.value = false
  }
}

const newTrip = reactive({
  vin: undefined as string | undefined,
  startTime: '',
  endTime: '',
  startAddress: '',
  endAddress: '',
  distanceKm: '',
  purpose: 'unclassified',
  driver: '',
  notes: '',
})

async function submitAddTrip() {
  if (!newTrip.vin || !newTrip.startTime) {
    toast.add({ title: 'VIN and start time are required', color: 'red' })
    return
  }
  addingTrip.value = true
  try {
    await $fetch('/api/trips', {
      method: 'POST',
      body: {
        vin: newTrip.vin,
        startTime: newTrip.startTime,
        endTime: newTrip.endTime || undefined,
        startAddress: newTrip.startAddress,
        endAddress: newTrip.endAddress,
        distanceKm: newTrip.distanceKm ? parseFloat(newTrip.distanceKm) : 0,
        purpose: newTrip.purpose,
        driver: newTrip.driver,
        notes: newTrip.notes,
      },
    })
    toast.add({ title: 'Trip added', color: 'green' })
    showAddModal.value = false
    await loadTrips()
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'red' })
  } finally {
    addingTrip.value = false
  }
}
</script>
