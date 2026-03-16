<template>
  <UCard
    class="cursor-pointer hover:shadow-md transition-shadow"
    @click="emit('click', trip)"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0 space-y-1">
        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>{{ formatDate(trip.startTime) }}</span>
          <span>{{ formatTime(trip.startTime) }}</span>
          <span v-if="trip.endTime">– {{ formatTime(trip.endTime) }}</span>
        </div>
        <div class="flex items-start gap-1 text-sm">
          <span class="font-medium text-gray-900 dark:text-white truncate">
            {{ trip.startAddress || 'Unknown departure' }}
          </span>
          <span class="text-gray-400 flex-shrink-0">→</span>
          <span class="font-medium text-gray-900 dark:text-white truncate">
            {{ trip.endAddress || (trip.status === 'in_progress' ? 'In progress...' : 'Unknown destination') }}
          </span>
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span v-if="trip.distanceKm">{{ trip.distanceKm.toFixed(1) }} km</span>
          <span v-if="trip.driver">{{ trip.driver }}</span>
          <span v-if="trip.vin" class="font-mono">{{ trip.vin }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <UBadge :color="purposeColor">
          {{ purposeLabel }}
        </UBadge>

        <USelectMenu
          v-if="showClassify"
          v-model="selectedPurpose"
          :items="purposeOptions"
          value-key="value"
          size="xs"
          placeholder="Classify..."
          class="w-36"
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
