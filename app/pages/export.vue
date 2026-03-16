<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Export</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Export your logbook — compliant with German Tax Office requirements
      </p>
    </div>

    <!-- Export Configuration -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-gray-900 dark:text-white">Export configuration</h2>
      </template>

      <div class="grid md:grid-cols-3 gap-4">
        <UFormField label="Vehicle" class="w-full">
          <USelectMenu v-model="exportConfig.vin" :items="vehicleOptions" value-key="value" placeholder="All vehicles" class="w-full" />
        </UFormField>
        <UFormField label="Year" class="w-full">
          <USelectMenu v-model="exportConfig.year" :items="yearOptions" value-key="value" placeholder="Select year" class="w-full" />
        </UFormField>
        <UFormField label="Filter by purpose" class="w-full">
          <USelectMenu v-model="exportConfig.purpose" :items="purposeOptions" value-key="value" placeholder="All trips" class="w-full" />
        </UFormField>
      </div>
    </UCard>

    <!-- Preview Stats -->
    <div v-if="previewStats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatsCard label="Total trips" :value="previewStats.totalTrips" :decimals="0" icon="i-heroicons-list-bullet" color="blue" />
      <StatsCard label="Total distance" :value="previewStats.totalKm" unit="km" icon="i-heroicons-map" color="blue" />
      <StatsCard label="Business" :value="previewStats.businessKm" unit="km" icon="i-heroicons-briefcase" color="green" />
      <StatsCard label="Private" :value="previewStats.privateKm" unit="km" icon="i-heroicons-home" color="purple" />
    </div>

    <!-- Tax Office Compliance Notice -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      title="Tax Office compliance"
      description="The export includes all fields required by the German tax authority: date, departure and destination, distance in km, odometer readings (if available), trip purpose, business contact (for business trips), driver name, and vehicle data. Annual totals (total km, business/private) are listed separately."
    />

    <!-- Export Buttons -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-gray-900 dark:text-white">Download</h2>
      </template>

      <div class="flex flex-wrap gap-4">
        <div class="flex-1 min-w-64">
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <div class="flex items-center gap-3">
              <div class="bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
                <UIcon name="i-heroicons-table-cells" class="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">CSV Export</h3>
                <p class="text-xs text-gray-500">For Excel / tax advisor</p>
              </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Tabular export with semicolon delimiter and BOM for Excel compatibility.
              Includes all required fields and annual summary.
            </p>
            <UButton
              icon="i-heroicons-arrow-down-tray"
              color="green"
              variant="outline"
              class="w-full"
              :disabled="!exportConfig.year"
              @click="exportCsv"
            >
              Download as CSV
            </UButton>
          </div>
        </div>

        <div class="flex-1 min-w-64">
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <div class="flex items-center gap-3">
              <div class="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
                <UIcon name="i-heroicons-document-text" class="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">PDF (print view)</h3>
                <p class="text-xs text-gray-500">For Tax Office / archive</p>
              </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Opens a print-optimised HTML page with cover sheet, annual summary, and full trip list.
              Print it as PDF from your browser.
            </p>
            <UButton
              icon="i-heroicons-printer"
              color="red"
              variant="outline"
              class="w-full"
              :disabled="!exportConfig.year"
              @click="exportPdf"
            >
              Open PDF preview
            </UButton>
          </div>
        </div>
      </div>

      <div v-if="!exportConfig.year" class="mt-3">
        <UAlert icon="i-heroicons-exclamation-triangle" color="yellow" title="Select a year" description="Please select a year before exporting." />
      </div>
    </UCard>

    <!-- Trip Preview Table -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-gray-900 dark:text-white">Preview</h2>
          <UBadge color="gray" :label="`${previewTrips.length} trips`" />
        </div>
      </template>

      <div v-if="previewLoading" class="py-8 flex justify-center">
        <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-blue-500" />
      </div>

      <div v-else-if="previewTrips.length === 0" class="text-center py-8 text-gray-500">
        <p>No trips found for the selected filters</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 px-3 font-medium text-gray-500">Date</th>
              <th class="text-left py-2 px-3 font-medium text-gray-500">From</th>
              <th class="text-left py-2 px-3 font-medium text-gray-500">To</th>
              <th class="text-right py-2 px-3 font-medium text-gray-500">km</th>
              <th class="text-left py-2 px-3 font-medium text-gray-500">Purpose</th>
              <th class="text-left py-2 px-3 font-medium text-gray-500">Driver</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="trip in previewTrips.slice(0, 20)"
              :key="String(trip._id)"
              class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td class="py-2 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {{ formatDate(trip.startTime) }}
              </td>
              <td class="py-2 px-3 max-w-[200px] truncate text-gray-700 dark:text-gray-300">
                {{ trip.startAddress || '–' }}
              </td>
              <td class="py-2 px-3 max-w-[200px] truncate text-gray-700 dark:text-gray-300">
                {{ trip.endAddress || '–' }}
              </td>
              <td class="py-2 px-3 text-right font-medium tabular-nums">
                {{ (trip.distanceKm || 0).toFixed(1) }}
              </td>
              <td class="py-2 px-3">
                <UBadge :color="purposeColor(trip.purpose)" size="xs">
                  {{ purposeLabel(trip.purpose) }}
                </UBadge>
              </td>
              <td class="py-2 px-3 text-gray-600 dark:text-gray-400">
                {{ trip.driver || '–' }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="previewTrips.length > 20" class="text-sm text-gray-500 text-center mt-2">
          ... and {{ previewTrips.length - 20 }} more trips (included in export)
        </p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { Vehicle, Trip, TripStats } from '~/types'

const { data: vehicles } = await useFetch<Vehicle[]>('/api/vehicles')

const vehicleOptions = computed(() => [
  { label: 'All vehicles', value: undefined },
  ...(vehicles.value || []).map(v => ({
    label: `${v.licensePlate || v.vin} (${v.make} ${v.model})`,
    value: v.vin,
  })),
])

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => ({
  label: String(currentYear - i),
  value: String(currentYear - i),
}))

const purposeOptions = [
  { label: 'All trips', value: undefined },
  { label: 'Business', value: 'business' },
  { label: 'Private', value: 'private' },
]

const exportConfig = reactive({
  vin: undefined as string | undefined,
  year: String(currentYear),
  purpose: undefined as string | undefined,
})

const previewLoading = ref(false)
const previewTrips = ref<Trip[]>([])
const previewStats = ref<TripStats | null>(null)

async function loadPreview() {
  previewLoading.value = true
  try {
    const params: Record<string, string> = { limit: '500' }
    if (exportConfig.vin) params.vin = exportConfig.vin
    if (exportConfig.year) params.year = exportConfig.year
    if (exportConfig.purpose) params.purpose = exportConfig.purpose

    const [tripsResult, statsResult] = await Promise.all([
      $fetch<{ trips: Trip[] }>('/api/trips', { params }),
      $fetch<TripStats>('/api/stats', { params: { vin: exportConfig.vin || '', year: exportConfig.year } }),
    ])

    previewTrips.value = tripsResult.trips
    previewStats.value = statsResult
  } finally {
    previewLoading.value = false
  }
}

await loadPreview()
watch(exportConfig, () => loadPreview(), { deep: true })

function buildExportUrl(format: string): string {
  const params = new URLSearchParams()
  if (exportConfig.vin) params.set('vin', exportConfig.vin)
  if (exportConfig.year) params.set('year', exportConfig.year)
  if (exportConfig.purpose) params.set('purpose', exportConfig.purpose)
  params.set('format', format)
  return `/api/trips/export?${params.toString()}`
}

function exportCsv() {
  window.open(buildExportUrl('csv'), '_blank')
}

function exportPdf() {
  window.open(buildExportUrl('html') + '&print=1', '_blank')
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US')
}

function purposeColor(p: string): any {
  const map: Record<string, string> = {
    business: 'blue',
    private: 'purple',
    unclassified: 'red',
  }
  return map[p] || 'gray'
}

function purposeLabel(p: string): string {
  const map: Record<string, string> = {
    business: 'Business',
    private: 'Private',
    unclassified: 'Open',
  }
  return map[p] || p
}
</script>
