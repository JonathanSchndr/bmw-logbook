<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {{ currentYear }} · Trip overview
        </p>
      </div>
      <div class="flex items-center gap-3">
        <USelectMenu
          v-model="selectedVin"
          :items="vehicleOptions"
          value-key="value"
          placeholder="All vehicles"
          size="sm"
          class="w-48"
        />
      </div>
    </div>

    <!-- Not configured banner -->
    <UAlert
      v-if="!hasSettings"
      icon="i-heroicons-exclamation-triangle"
      color="yellow"
      title="Setup required"
      description="Please configure your BMW authentication and MQTT connection in Settings."
    >
      <template #actions>
        <UButton to="/settings" size="sm" label="Go to Settings" />
      </template>
    </UAlert>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        label="Total distance"
        :value="stats?.totalKm || 0"
        unit="km"
        icon="i-heroicons-map-pin"
        color="blue"
        :subtitle="`${stats?.totalTrips || 0} trips total`"
      />
      <StatsCard
        label="Business"
        :value="stats?.businessKm || 0"
        unit="km"
        icon="i-heroicons-briefcase"
        color="blue"
        :subtitle="`${businessPercent}% of total`"
      />
      <StatsCard
        label="Private"
        :value="stats?.privateKm || 0"
        unit="km"
        icon="i-heroicons-home"
        color="purple"
      />
      <StatsCard
        label="Unclassified"
        :value="stats?.unclassifiedTrips || 0"
        unit=""
        icon="i-heroicons-question-mark-circle"
        :color="(stats?.unclassifiedTrips || 0) > 0 ? 'red' : 'green'"
        subtitle="trips pending"
        :decimals="0"
      />
    </div>

    <!-- This month stats -->
    <div class="grid grid-cols-2 gap-4">
      <StatsCard
        label="This month"
        :value="stats?.thisMonthKm || 0"
        unit="km"
        icon="i-heroicons-calendar"
        color="green"
        :subtitle="`${stats?.tripsThisMonth || 0} trips`"
      />
      <StatsCard
        label="Avg. trip length"
        :value="stats?.avgTripKm || 0"
        unit="km"
        icon="i-heroicons-arrow-trending-up"
        color="orange"
        subtitle="Average per trip"
      />
    </div>

    <!-- Recent Trips -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent trips</h2>
        <UButton to="/trips" variant="ghost" size="sm" trailing-icon="i-heroicons-arrow-right">
          View all
        </UButton>
      </div>

      <div v-if="tripsLoading" class="space-y-3">
        <USkeleton v-for="i in 5" :key="i" class="h-24 rounded-lg" />
      </div>

      <div v-else-if="recentTrips.length === 0" class="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <UIcon name="i-heroicons-map" class="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p class="text-gray-500 dark:text-gray-400">No trips recorded yet</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Connect your vehicle via MQTT to start recording trips automatically
        </p>
      </div>

      <div v-else class="space-y-3">
        <TripCard
          v-for="trip in recentTrips"
          :key="trip._id"
          :trip="trip"
          show-classify
          @click="navigateTo(`/trips/${trip._id}`)"
          @classify="classifyTrip"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Trip, TripStats, Vehicle } from '~/types'

const currentYear = new Date().getFullYear()
const selectedVin = ref<string | undefined>(undefined)

const { data: settings } = await useFetch('/api/settings')
const hasSettings = computed(() =>
  settings.value?.hasAccessToken || settings.value?.mqttHost,
)

const { data: vehicles } = await useFetch<Vehicle[]>('/api/vehicles')
const vehicleOptions = computed(() => [
  { label: 'All vehicles', value: undefined },
  ...(vehicles.value || []).map(v => ({
    label: `${v.licensePlate || v.vin} (${v.make} ${v.model})`,
    value: v.vin,
  })),
])

const { data: stats } = await useFetch<TripStats>('/api/stats', {
  params: computed(() => ({
    year: currentYear,
    ...(selectedVin.value ? { vin: selectedVin.value } : {}),
  })),
})

const businessPercent = computed(() => {
  const total = stats.value?.totalKm || 0
  const business = stats.value?.businessKm || 0
  if (total === 0) return 0
  return Math.round((business / total) * 100)
})

const tripsLoading = ref(false)
const recentTrips = ref<Trip[]>([])

async function loadRecentTrips() {
  tripsLoading.value = true
  try {
    const result = await $fetch<{ trips: Trip[] }>('/api/trips', {
      params: {
        limit: 5,
        ...(selectedVin.value ? { vin: selectedVin.value } : {}),
      },
    })
    recentTrips.value = result.trips
  } finally {
    tripsLoading.value = false
  }
}

await loadRecentTrips()

watch(selectedVin, () => {
  loadRecentTrips()
})

const toast = useToast()

async function classifyTrip(id: string, purpose: string) {
  try {
    await $fetch(`/api/trips/${id}`, {
      method: 'PATCH' as any,
      body: { purpose },
    })
    const idx = recentTrips.value.findIndex(t => t._id === id)
    if (idx !== -1) recentTrips.value[idx].purpose = purpose as any
    toast.add({ title: 'Trip classified', icon: 'i-heroicons-check-circle', color: 'green' })
  } catch {
    toast.add({ title: 'Failed to classify trip', color: 'red' })
  }
}
</script>
