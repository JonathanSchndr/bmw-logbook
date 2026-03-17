<template>
  <UCard
    class="cursor-pointer hover:shadow-md transition-shadow"
    @click="emit('click', trip)"
  >
    <div class="space-y-2">
      <!-- Top row: date/time + badge -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 min-w-0">
          <span class="shrink-0">{{ formatDate(trip.startTime) }}</span>
          <span class="shrink-0">{{ formatTime(trip.startTime) }}</span>
          <span v-if="trip.endTime" class="shrink-0">– {{ formatTime(trip.endTime) }}</span>
        </div>
        <UBadge :color="purposeColor" class="shrink-0">
          {{ purposeLabel }}
        </UBadge>
      </div>

      <!-- Addresses -->
      <div class="space-y-0.5">
        <div class="flex items-baseline gap-1.5 text-sm min-w-0">
          <span class="text-gray-400 shrink-0 text-xs">From</span>
          <span class="font-medium text-gray-900 dark:text-white truncate">
            {{ trip.startAddress || 'Unknown departure' }}
          </span>
        </div>
        <div class="flex items-baseline gap-1.5 text-sm min-w-0">
          <span class="text-gray-400 shrink-0 text-xs">To</span>
          <span class="font-medium text-gray-900 dark:text-white truncate">
            {{ trip.endAddress || (trip.status === 'in_progress' ? 'In progress...' : 'Unknown destination') }}
          </span>
        </div>
      </div>

      <!-- Bottom row: meta + classify -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span v-if="trip.distanceKm">{{ trip.distanceKm.toFixed(1) }} km</span>
          <span v-if="trip.driver">{{ trip.driver }}</span>
          <span v-if="trip.vin" class="font-mono hidden sm:inline">{{ trip.vin }}</span>
        </div>
        <USelectMenu
          v-if="showClassify"
          v-model="selectedPurpose"
          :items="purposeOptions"
          value-key="value"
          size="xs"
          placeholder="Classify..."
          class="w-36 shrink-0"
          @update:model-value="handleClassify"
          @click.stop
        />
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { Trip } from '~/types'

interface Props {
  trip: Trip
  showClassify?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showClassify: true,
})

const emit = defineEmits<{
  click: [trip: Trip]
  classify: [id: string, purpose: string]
}>()

const selectedPurpose = ref<string | undefined>(undefined)

const purposeOptions = [
  { label: 'Business', value: 'business' },
  { label: 'Private', value: 'private' },
  { label: 'Unclassified', value: 'unclassified' },
]

const purposeColor = computed((): any => {
  const map: Record<string, string> = {
    business: 'blue',
    private: 'purple',
    unclassified: 'red',
  }
  return map[props.trip.purpose] || 'gray'
})

const purposeLabel = computed(() => {
  const map: Record<string, string> = {
    business: 'Business',
    private: 'Private',
    unclassified: 'Open',
  }
  return map[props.trip.purpose] || props.trip.purpose
})

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function handleClassify(value: string) {
  if (value && props.trip._id) {
    emit('classify', props.trip._id, value)
    selectedPurpose.value = undefined
  }
}
</script>
