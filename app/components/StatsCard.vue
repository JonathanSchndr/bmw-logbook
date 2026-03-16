<template>
  <UCard class="overflow-hidden">
    <div class="flex items-center gap-4">
      <div
        class="flex-shrink-0 rounded-lg p-3"
        :class="iconBgClass"
      >
        <UIcon :name="icon" class="h-6 w-6" :class="iconColorClass" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
          {{ label }}
        </p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ formattedValue }}
        </p>
        <p v-if="subtitle" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {{ subtitle }}
        </p>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface Props {
  label: string
  value: number | string
  icon?: string
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray'
  unit?: string
  subtitle?: string
  decimals?: number
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'i-heroicons-chart-bar',
  color: 'blue',
  unit: '',
  decimals: 1,
})

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value
  const num = props.value
  const formatted = num % 1 === 0 ? num.toString() : num.toFixed(props.decimals)
  return props.unit ? `${formatted} ${props.unit}` : formatted
})

const iconBgClass = computed(() => {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30',
    green: 'bg-green-100 dark:bg-green-900/30',
    purple: 'bg-purple-100 dark:bg-purple-900/30',
    orange: 'bg-orange-100 dark:bg-orange-900/30',
    red: 'bg-red-100 dark:bg-red-900/30',
    gray: 'bg-gray-100 dark:bg-gray-700',
  }
  return map[props.color] || map.blue
})

const iconColorClass = computed(() => {
  const map: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-600 dark:text-gray-400',
  }
  return map[props.color] || map.blue
})
</script>
