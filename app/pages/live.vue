<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Live Data</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Real-time vehicle telematics</p>
      </div>
      <MqttStatusBadge :show-reconnect="true" />
    </div>

    <!-- Vehicle selector -->
    <UCard>
      <div class="flex items-center gap-4 flex-wrap">
        <USelectMenu v-model="selectedVin" :items="vehicleOptions" value-key="value" placeholder="Select vehicle" class="w-64" />
        <UButton
          v-if="selectedVin"
          icon="i-heroicons-arrow-path"
          variant="outline"
          size="sm"
          :loading="refreshing"
          @click="loadLiveData"
        >
          Refresh
        </UButton>
        <span v-if="liveData?.lastUpdate" class="text-sm text-gray-500 dark:text-gray-400">
          Last update: {{ formatDateTime(liveData.lastUpdate) }}
        </span>
      </div>
    </UCard>

    <div v-if="!selectedVin" class="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <UIcon name="i-heroicons-signal" class="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
      <p class="text-gray-500 dark:text-gray-400">Select a vehicle to view live data</p>
    </div>

    <template v-else-if="liveData">
      <!-- Current trip indicator -->
      <UAlert
        v-if="currentTripActive"
        icon="i-heroicons-map-pin"
        color="green"
        title="Trip in progress"
        description="An active trip is currently being recorded."
      />

      <!-- Quick stats from live data -->
      <div v-if="locationData" class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <UCard class="text-center">
          <p class="text-xs text-gray-500 mb-1">Latitude</p>
          <p class="font-mono font-bold text-lg">{{ locationData.lat?.toFixed(6) ?? '–' }}</p>
        </UCard>
        <UCard class="text-center">
          <p class="text-xs text-gray-500 mb-1">Longitude</p>
          <p class="font-mono font-bold text-lg">{{ locationData.lng?.toFixed(6) ?? '–' }}</p>
        </UCard>
        <UCard v-if="odometerValue" class="text-center">
          <p class="text-xs text-gray-500 mb-1">Odometer</p>
          <p class="font-mono font-bold text-lg">{{ odometerValue }} km</p>
        </UCard>
      </div>

      <!-- Live map -->
      <UCard v-if="locationData">
        <template #header>
          <h3 class="font-semibold">Current position</h3>
        </template>
        <ClientOnly>
          <TripMap :start-location="locationData" height="300px" start-address="Current position" />
          <template #fallback>
            <div class="h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
              <p class="text-gray-500">Loading map...</p>
            </div>
          </template>
        </ClientOnly>
      </UCard>

      <!-- Data categories -->
      <div class="space-y-4">
        <UCard v-for="(events, category) in liveData.categories" :key="category">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 font-mono">
                {{ category }}
              </h3>
              <UBadge color="gray" size="xs">{{ events.length }}</UBadge>
            </div>
          </template>

          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            <div
              v-for="item in events"
              :key="item.name"
              class="flex items-center justify-between py-2 text-sm"
            >
              <span class="text-gray-600 dark:text-gray-400 font-mono text-xs truncate max-w-[60%]">
                {{ item.name }}
              </span>
              <div class="text-right">
                <span class="font-medium text-gray-900 dark:text-white">
                  {{ item.value }}
                  <span v-if="item.unit" class="text-gray-500 text-xs ml-0.5">{{ item.unit }}</span>
                </span>
                <p class="text-xs text-gray-400">{{ formatTime(item.timestamp) }}</p>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <div v-if="Object.keys(liveData.categories || {}).length === 0" class="text-center py-8 text-gray-500">
        <UIcon name="i-heroicons-signal-slash" class="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>No live data received yet</p>
        <p class="text-sm mt-1">Make sure MQTT is connected and the vehicle is sending data</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Vehicle } from '~/types'

const selectedVin = ref<string | undefined>(undefined)
const refreshing = ref(false)

const { data: vehicles } = await useFetch<Vehicle[]>('/api/vehicles')
const vehicleOptions = computed(() =>
  (vehicles.value || []).map(v => ({
    label: `${v.licensePlate || v.vin} – ${v.make} ${v.model}`,
    value: v.vin,
  })),
)

if (vehicles.value?.length) {
  selectedVin.value = vehicles.value[0].vin
}

interface LiveData {
  vin: string
  latestValues: Array<{ name: string; value: string; unit: string; timestamp: Date }>
  categories: Record<string, Array<{ name: string; value: string; unit: string; timestamp: Date }>>
  lastUpdate: Date | null
}

const liveData = ref<LiveData | null>(null)

const locationData = computed(() => {
  if (!liveData.value) return null
  const latItem = liveData.value.latestValues.find(v => v.name.includes('latitude'))
  const lngItem = liveData.value.latestValues.find(v => v.name.includes('longitude'))
  if (!latItem || !lngItem) return null
  const lat = parseFloat(latItem.value)
  const lng = parseFloat(lngItem.value)
  if (isNaN(lat) || isNaN(lng)) return null
  return { lat, lng }
})

const odometerValue = computed(() => {
  const item = liveData.value?.latestValues.find(v =>
    v.name === 'vehicle.vehicle.travelledDistance' ||
    v.name.toLowerCase().includes('odometer'),
  )
  return item?.value || null
})

const currentTripActive = ref(false)

async function loadLiveData() {
  if (!selectedVin.value) return
  refreshing.value = true
  try {
    liveData.value = await $fetch<LiveData>(`/api/vehicles/${selectedVin.value}/live`)
    const tripsResult = await $fetch<{ trips: any[] }>('/api/trips', {
      params: { vin: selectedVin.value, status: 'in_progress', limit: 1 },
    })
    currentTripActive.value = (tripsResult.trips?.length || 0) > 0
  } catch (err) {
    console.error('Failed to load live data:', err)
  } finally {
    refreshing.value = false
  }
}

watch(selectedVin, async (vin) => {
  if (vin) await loadLiveData()
})

if (selectedVin.value) {
  await loadLiveData()
}

let refreshInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refreshInterval = setInterval(() => {
    if (selectedVin.value) loadLiveData()
  }, 30000)
})
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('en-US', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
</script>
