<template>
  <div class="flex items-center gap-2">
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      :class="badgeClass"
    >
      <span
        class="inline-block h-2 w-2 rounded-full"
        :class="[dotClass, status.connecting ? 'animate-pulse' : '']"
      />
      {{ statusText }}
    </span>
    <UButton
      v-if="showReconnect"
      size="xs"
      variant="ghost"
      icon="i-heroicons-arrow-path"
      :loading="reconnecting"
      @click="handleReconnect"
    >
      Reconnect
    </UButton>
  </div>
</template>

<script setup lang="ts">
interface MqttStatus {
  connected: boolean
  connecting: boolean
  error: string | null
  lastConnectedAt: Date | null
}

interface Props {
  showReconnect?: boolean
}

withDefaults(defineProps<Props>(), {
  showReconnect: false,
})

const { data: status, refresh } = useFetch<MqttStatus>('/api/mqtt/status', {
  default: () => ({ connected: false, connecting: false, error: null, lastConnectedAt: null }),
})

const reconnecting = ref(false)

const badgeClass = computed(() => {
  if (!status.value) return 'bg-gray-100 text-gray-700'
  if (status.value.connected) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  if (status.value.connecting) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
})

const dotClass = computed(() => {
  if (!status.value) return 'bg-gray-400'
  if (status.value.connected) return 'bg-green-500'
  if (status.value.connecting) return 'bg-yellow-500'
  return 'bg-red-500'
})

const statusText = computed(() => {
  if (!status.value) return 'Unknown'
  if (status.value.connected) return 'MQTT connected'
  if (status.value.connecting) return 'Connecting...'
  if (status.value.error) return `Error: ${status.value.error.substring(0, 40)}`
  return 'MQTT disconnected'
})

async function handleReconnect() {
  reconnecting.value = true
  try {
    await $fetch('/api/mqtt/reconnect', { method: 'POST' })
    await new Promise(resolve => setTimeout(resolve, 2000))
    await refresh()
  } catch (err) {
    console.error('Reconnect failed:', err)
  } finally {
    reconnecting.value = false
  }
}

onMounted(() => {
  const interval = setInterval(refresh, 30000)
  onUnmounted(() => clearInterval(interval))
})
</script>
