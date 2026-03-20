<template>
  <UApp>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Sidebar Navigation -->
    <aside
      class="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    >
      <!-- Logo -->
      <div class="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <UIcon name="i-mdi-car" class="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 class="font-bold text-gray-900 dark:text-white text-sm leading-tight">BMW Logbook</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400">Digital Driving Log</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="isActive(item.to)
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'"
        >
          <UIcon :name="item.icon" class="h-5 w-5 shrink-0" />
          {{ item.label }}
          <UBadge
            v-if="item.badge"
            :label="String(item.badge)"
            size="xs"
            color="error"
            class="ml-auto"
          />
        </NuxtLink>
      </nav>

      <!-- MQTT Status at bottom -->
      <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
        <MqttStatusBadge />
      </div>
    </aside>

    <!-- Overlay for mobile -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-40 bg-black/50 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Main Content -->
    <div class="lg:pl-64 min-h-screen flex flex-col">
      <!-- Top bar -->
      <header class="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-4">
        <UButton
          variant="ghost"
          icon="i-heroicons-bars-3"
          class="lg:hidden"
          @click="sidebarOpen = !sidebarOpen"
        />
        <div class="flex-1" />
        <UButton
          variant="ghost"
          :icon="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
          @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
        />
        <UButton
          v-if="authStatus?.passwordProtected"
          variant="ghost"
          icon="i-heroicons-arrow-right-on-rectangle"
          @click="logout"
        />
      </header>

      <!-- Pull-to-refresh indicator -->
      <div
        v-if="pullDistance > 0 || refreshing"
        class="fixed top-14 left-0 right-0 lg:left-64 flex justify-center pointer-events-none z-40"
        :style="{ transform: `translateY(${Math.min(pullDistance, PULL_THRESHOLD) - PULL_THRESHOLD}px)` }"
      >
        <div class="bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg">
          <UIcon
            name="i-heroicons-arrow-path"
            class="h-5 w-5 text-blue-600"
            :class="{ 'animate-spin': refreshing }"
            :style="!refreshing ? { transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)` } : {}"
          />
        </div>
      </div>

      <!-- Page Content -->
      <main
        class="flex-1 p-6"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
        @touchend.passive="onTouchEnd"
      >
        <slot />
      </main>
    </div>
  </div>
  </UApp>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)
const colorMode = useColorMode()

const { data: authStatus } = await useFetch('/api/auth/status')

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  router.push('/login')
}

const { data: unclassifiedCount } = await useFetch('/api/trips', {
  params: { purpose: 'unclassified', limit: 1 },
  transform: (data: any) => data?.total || 0,
})

const navItems = computed(() => [
  { to: '/', label: 'Dashboard', icon: 'i-heroicons-home' },
  {
    to: '/trips',
    label: 'Trips',
    icon: 'i-heroicons-map',
    badge: unclassifiedCount.value || undefined,
  },
  { to: '/vehicles', label: 'Vehicles', icon: 'i-mdi-car' },
  { to: '/live', label: 'Live Data', icon: 'i-heroicons-signal' },
  { to: '/export', label: 'Export', icon: 'i-heroicons-arrow-down-tray' },
  { to: '/settings', label: 'Settings', icon: 'i-heroicons-cog-6-tooth' },
])

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

watch(() => route.path, () => {
  sidebarOpen.value = false
})

// Pull-to-refresh
const PULL_THRESHOLD = 80
const touchStartY = ref(0)
const pullDistance = ref(0)
const refreshing = ref(false)

function onTouchStart(e: TouchEvent) {
  if (window.scrollY === 0) {
    touchStartY.value = e.touches[0]!.clientY
  }
}

function onTouchMove(e: TouchEvent) {
  if (touchStartY.value === 0) return
  const delta = e.touches[0]!.clientY - touchStartY.value
  if (delta > 0 && window.scrollY === 0) {
    pullDistance.value = delta
  }
}

async function onTouchEnd() {
  if (pullDistance.value >= PULL_THRESHOLD && !refreshing.value) {
    refreshing.value = true
    pullDistance.value = PULL_THRESHOLD
    try {
      await refreshNuxtData()
    } finally {
      refreshing.value = false
    }
  }
  pullDistance.value = 0
  touchStartY.value = 0
}
</script>
