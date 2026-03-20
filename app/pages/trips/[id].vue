<template>
  <div class="space-y-6">
    <!-- Back -->
    <UButton to="/trips" variant="ghost" icon="i-heroicons-arrow-left" size="sm">
      Back to trips
    </UButton>

    <div v-if="pending" class="space-y-4">
      <USkeleton class="h-[450px] rounded-xl" />
      <USkeleton class="h-48 rounded-xl" />
    </div>

    <template v-else-if="data?.trip">
      <!-- Full-width map -->
      <UCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h2 class="font-semibold text-gray-900 dark:text-white">Route</h2>
              <UBadge :color="statusColor" size="sm">{{ statusLabel }}</UBadge>
              <UBadge :color="purposeColor" size="sm">{{ purposeLabel }}</UBadge>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ formatDate(data.trip.startTime) }}
              · {{ (data.trip.distanceKm || 0).toFixed(1) }} km
            </div>
          </div>
        </template>
        <ClientOnly>
          <TripMap
            :waypoints="mapWaypoints"
            :start-location="mapStartLocation"
            :end-location="mapEndLocation"
            :start-address="data.trip.startAddress"
            :end-address="data.trip.endAddress"
            height="450px"
          />
          <template #fallback>
            <div class="h-[450px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <p class="text-gray-500">Loading map...</p>
            </div>
          </template>
        </ClientOnly>
      </UCard>

      <!-- Details + Edit form side by side -->
      <div class="grid lg:grid-cols-2 gap-6">
        <!-- Trip details -->
        <UCard>
          <template #header>
            <h3 class="font-semibold text-gray-900 dark:text-white">Trip details</h3>
          </template>

          <dl class="space-y-3 text-sm">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <dt class="text-gray-500 dark:text-gray-400">Departure</dt>
                <dd class="font-medium">{{ formatTime(data.trip.startTime) }}</dd>
              </div>
              <div>
                <dt class="text-gray-500 dark:text-gray-400">Arrival</dt>
                <dd class="font-medium">{{ data.trip.endTime ? formatTime(data.trip.endTime) : '–' }}</dd>
              </div>
            </div>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">From</dt>
              <dd class="font-medium">{{ data.trip.startAddress || '–' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">To</dt>
              <dd class="font-medium">{{ data.trip.endAddress || '–' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Distance</dt>
              <dd class="font-medium">{{ (data.trip.distanceKm || 0).toFixed(1) }} km</dd>
            </div>
            <div v-if="data.trip.startOdometer !== null || data.trip.endOdometer !== null" class="grid grid-cols-2 gap-3">
              <div>
                <dt class="text-gray-500 dark:text-gray-400">Odometer start</dt>
                <dd class="font-medium">{{ data.trip.startOdometer ?? '–' }} km</dd>
              </div>
              <div>
                <dt class="text-gray-500 dark:text-gray-400">Odometer end</dt>
                <dd class="font-medium">{{ data.trip.endOdometer ?? '–' }} km</dd>
              </div>
            </div>
            <div>
              <dt class="text-gray-500 dark:text-gray-400 font-mono text-xs">VIN</dt>
              <dd class="font-mono text-xs text-gray-600 dark:text-gray-400">{{ data.trip.vin }}</dd>
            </div>
          </dl>
        </UCard>

        <!-- Edit form -->
        <UCard>
          <template #header>
            <h3 class="font-semibold text-gray-900 dark:text-white">Edit trip</h3>
          </template>

          <form class="space-y-4" @submit.prevent="saveTrip">
            <UFormField label="Purpose" class="w-full">
              <USelectMenu v-model="editForm.purpose" :items="purposeOptions" value-key="value" class="w-full" />
            </UFormField>


            <UFormField label="Driver" class="w-full">
              <UInput v-model="editForm.driver" placeholder="Driver name" class="w-full" />
            </UFormField>

            <UFormField label="Departure address" class="w-full">
              <AddressAutocomplete v-model="editForm.startAddress" placeholder="Departure address" />
            </UFormField>

            <UFormField label="Destination address" class="w-full">
              <AddressAutocomplete v-model="editForm.endAddress" placeholder="Destination address" />
            </UFormField>

            <UFormField label="Distance (km)" class="w-full">
              <div class="flex gap-2">
                <UInput v-model="editForm.distanceKm" type="number" step="0.1" class="w-full" />
                <UButton
                  type="button"
                  variant="outline"
                  size="sm"
                  icon="i-heroicons-calculator"
                  :loading="calculatingDistance"
                  :disabled="!editForm.startAddress || !editForm.endAddress"
                  title="Calculate distance from addresses"
                  @click="calculateDistance"
                />
              </div>
            </UFormField>

            <UFormField label="Notes" class="w-full">
              <UTextarea v-model="editForm.notes" :rows="3" placeholder="Optional notes..." class="w-full" />
            </UFormField>

            <div class="flex justify-between items-center pt-2">
              <UButton color="error" variant="ghost" size="sm" icon="i-heroicons-trash" @click="confirmDelete">
                Delete
              </UButton>
              <UButton type="submit" :loading="saving">
                Save
              </UButton>
            </div>
          </form>
        </UCard>
      </div>

      <!-- Event timeline (collapsed by default) -->
      <UCard v-if="data.rawEvents && data.rawEvents.length > 0">
        <template #header>
          <button class="flex items-center justify-between w-full" @click="showEvents = !showEvents">
            <h3 class="font-semibold text-gray-900 dark:text-white">Event timeline</h3>
            <div class="flex items-center gap-2">
              <UBadge color="neutral" size="sm">{{ data.rawEvents.length }} events</UBadge>
              <UIcon :name="showEvents ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="h-4 w-4 text-gray-400" />
            </div>
          </button>
        </template>

        <div v-if="showEvents" class="space-y-1 max-h-64 overflow-y-auto">
          <div
            v-for="event in data.rawEvents"
            :key="String(event._id)"
            class="flex items-start gap-3 text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-0"
          >
            <span class="text-gray-400 dark:text-gray-500 whitespace-nowrap font-mono">
              {{ formatTime(event.timestamp) }}
            </span>
            <span class="text-gray-600 dark:text-gray-400 font-mono truncate flex-1">
              {{ event.name }}
            </span>
            <span class="text-gray-900 dark:text-white font-medium whitespace-nowrap">
              {{ event.value }}{{ event.unit ? ` ${event.unit}` : '' }}
            </span>
          </div>
        </div>
      </UCard>
    </template>

    <div v-else class="text-center py-16">
      <p class="text-gray-500">Trip not found</p>
    </div>

    <!-- Delete confirmation -->
    <UModal v-model:open="showDeleteModal" scrollable>
      <template #content>
        <UCard>
          <template #header>
            <h3 class="font-semibold text-red-600">Delete trip?</h3>
          </template>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            This action cannot be undone.
          </p>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" @click="showDeleteModal = false">Cancel</UButton>
              <UButton color="error" :loading="deleting" @click="deleteTrip">Delete</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Trip } from '~/types'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const id = route.params.id as string

const { data, pending } = await useFetch<{ trip: Trip; rawEvents: any[] }>(`/api/trips/${id}`)

const showEvents = ref(false)

// Road-snapped route from OSRM (calculated through GPS waypoints)
const routeWaypoints = ref<{ lat: number; lng: number }[]>([])

// Prefer OSRM road route, fall back to raw GPS waypoints so map never shows dashed line
const mapWaypoints = computed(() =>
  routeWaypoints.value.length > 1
    ? routeWaypoints.value
    : (data.value?.trip?.waypoints ?? []),
)
const mapStartLocation = computed(() => data.value?.trip?.startLocation ?? null)
const mapEndLocation = computed(() => data.value?.trip?.endLocation ?? null)

async function fetchRouteForMap() {
  const trip = data.value?.trip
  if (!trip?._id) return
  try {
    const res = await $fetch<{ distanceKm: number; waypoints: { lat: number; lng: number }[] }>(`/api/trips/${trip._id}/route`)
    routeWaypoints.value = res.waypoints
    // Update the displayed distance with the road distance from OSRM
    if (res.distanceKm && res.distanceKm > 0) {
      editForm.distanceKm = String(res.distanceKm)
    }
  } catch { /* OSRM unavailable — mapWaypoints falls back to raw GPS points */ }
}

watch(() => data.value?.trip, (trip) => {
  if (trip) fetchRouteForMap()
}, { immediate: true })

const purposeOptions = [
  { label: 'Unclassified', value: 'unclassified' },
  { label: 'Business', value: 'business' },
  { label: 'Private', value: 'private' },
]

const editForm = reactive({
  purpose: data.value?.trip?.purpose || 'unclassified',

  driver: data.value?.trip?.driver || '',
  startAddress: data.value?.trip?.startAddress || '',
  endAddress: data.value?.trip?.endAddress || '',
  distanceKm: String(data.value?.trip?.distanceKm || 0),
  notes: data.value?.trip?.notes || '',
})

watch(() => data.value?.trip, (trip) => {
  if (trip) {
    editForm.purpose = trip.purpose

    editForm.driver = trip.driver || ''
    editForm.startAddress = trip.startAddress || ''
    editForm.endAddress = trip.endAddress || ''
    editForm.distanceKm = String(trip.distanceKm || 0)
    editForm.notes = trip.notes || ''
  }
})

const purposeColor = computed((): any => {
  const map: Record<string, string> = { business: 'blue', private: 'purple', unclassified: 'red' }
  return map[editForm.purpose] || 'gray'
})

const purposeLabel = computed(() => {
  const map: Record<string, string> = { business: 'Business', private: 'Private', unclassified: 'Unclassified' }
  return map[editForm.purpose] || editForm.purpose
})

const statusColor = computed((): any => {
  const s = data.value?.trip?.status
  if (s === 'in_progress') return 'yellow'
  if (s === 'manual') return 'gray'
  return 'green'
})

const statusLabel = computed(() => {
  const s = data.value?.trip?.status
  if (s === 'in_progress') return 'Active'
  if (s === 'manual') return 'Manual'
  return 'Completed'
})

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const calculatingDistance = ref(false)

async function calculateDistance() {
  if (!editForm.startAddress || !editForm.endAddress) return
  calculatingDistance.value = true
  try {
    const [from, to] = await Promise.all([
      $fetch<{ found: boolean; lat: number | null; lng: number | null }>(`/api/geocode?q=${encodeURIComponent(editForm.startAddress)}`),
      $fetch<{ found: boolean; lat: number | null; lng: number | null }>(`/api/geocode?q=${encodeURIComponent(editForm.endAddress)}`),
    ])
    if (from.found && to.found && from.lat && from.lng && to.lat && to.lng) {
      const route = await $fetch<{ distanceKm: number; waypoints: { lat: number; lng: number }[] }>(
        `/api/route?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}`,
      )
      editForm.distanceKm = String(route.distanceKm)
    } else {
      toast.add({ title: 'Could not geocode one or both addresses', color: 'warning' })
    }
  } catch {
    toast.add({ title: 'Distance calculation failed', color: 'error' })
  } finally {
    calculatingDistance.value = false
  }
}

const saving = ref(false)
async function saveTrip() {
  saving.value = true
  try {
    await $fetch(`/api/trips/${id}`, {
      method: 'PATCH' as any,
      body: {
        purpose: editForm.purpose,

        driver: editForm.driver,
        startAddress: editForm.startAddress,
        endAddress: editForm.endAddress,
        distanceKm: parseFloat(editForm.distanceKm) || 0,
        notes: editForm.notes,
      },
    })
    toast.add({ title: 'Saved', icon: 'i-heroicons-check', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

const showDeleteModal = ref(false)
const deleting = ref(false)

function confirmDelete() {
  showDeleteModal.value = true
}

async function deleteTrip() {
  deleting.value = true
  try {
    await $fetch(`/api/trips/${id}`, { method: 'DELETE' as any })
    toast.add({ title: 'Trip deleted', color: 'success' })
    await router.push('/trips')
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'error' })
  } finally {
    deleting.value = false
    showDeleteModal.value = false
  }
}
</script>
