<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">BMW connection and app configuration</p>
    </div>

    <!-- Auth Status -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-gray-900 dark:text-white">BMW Authentication</h2>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            :class="authStatusClass"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="authDotClass" />
            {{ authStatusText }}
          </span>
        </div>
      </template>

      <!-- Token expiry info -->
      <div v-if="settings?.hasAccessToken" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p class="text-xs text-gray-500 mb-1">Access Token</p>
          <p class="text-sm font-medium" :class="tokenExpiryClass(settings.accessTokenExpiry)">
            {{ tokenExpiryText(settings.accessTokenExpiry) }}
          </p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p class="text-xs text-gray-500 mb-1">ID Token (MQTT)</p>
          <p class="text-sm font-medium" :class="tokenExpiryClass(settings.idTokenExpiry)">
            {{ tokenExpiryText(settings.idTokenExpiry) }}
          </p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p class="text-xs text-gray-500 mb-1">Refresh Token</p>
          <p class="text-sm font-medium" :class="tokenExpiryClass(settings.refreshTokenExpiry)">
            {{ tokenExpiryText(settings.refreshTokenExpiry) }}
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <UFormField label="BMW CarData Client ID" required class="w-full">
          <UInput
            v-model="authForm.clientId"
            placeholder="Your BMW CarData API Client ID"
            :disabled="authStep > 0"
            class="w-full"
          />
          <template #hint>
            <span class="text-xs text-gray-500">
              Generated in the BMW CarData customer portal (customer.bmwgroup.com)
            </span>
          </template>
        </UFormField>

        <!-- Step 1: Start Device Code Flow -->
        <div v-if="authStep === 0">
          <UButton
            :loading="startingAuth"
            :disabled="!authForm.clientId"
            icon="i-heroicons-key"
            @click="startDeviceCodeFlow"
          >
            Start authentication (Device Code Flow)
          </UButton>
        </div>

        <!-- Step 2: Show user code -->
        <div v-else-if="authStep === 1 && deviceCodeData" class="space-y-4">
          <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <h3 class="font-semibold text-blue-900 dark:text-blue-100 mb-3">
              Step 1: Link your BMW account
            </h3>
            <p class="text-sm text-blue-700 dark:text-blue-300 mb-3">
              Open the following URL in your browser and enter the code:
            </p>
            <div class="flex items-center gap-3 mb-3">
              <a
                :href="deviceCodeData.verification_uri_complete || deviceCodeData.verification_uri"
                target="_blank"
                class="text-blue-600 dark:text-blue-400 underline text-sm break-all"
              >
                {{ deviceCodeData.verification_uri }}
              </a>
              <UButton
                size="xs"
                variant="outline"
                icon="i-heroicons-arrow-top-right-on-square"
                :href="deviceCodeData.verification_uri_complete || deviceCodeData.verification_uri"
                target="_blank"
              >
                Open
              </UButton>
            </div>
            <div class="flex items-center gap-3">
              <p class="text-sm text-blue-700 dark:text-blue-300">Your code:</p>
              <code class="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-2 text-2xl font-bold font-mono tracking-widest text-blue-900 dark:text-blue-100">
                {{ deviceCodeData.user_code }}
              </code>
              <UButton
                size="xs"
                variant="ghost"
                icon="i-heroicons-clipboard-document"
                @click="copyCode(deviceCodeData!.user_code)"
              />
            </div>
            <p class="text-xs text-gray-500 mt-3">
              Code valid for {{ Math.ceil(deviceCodeData.expires_in / 60) }} minutes.
              Polling automatically...
            </p>
          </div>

          <div class="flex items-center gap-3">
            <UButton :loading="polling" icon="i-heroicons-arrow-path" @click="pollToken">
              {{ polling ? 'Checking...' : 'Check now' }}
            </UButton>
            <UButton variant="ghost" @click="cancelAuth">Cancel</UButton>
          </div>

          <div v-if="pollError" class="text-sm text-red-500">
            {{ pollError }}
          </div>
        </div>

        <!-- Step 3: Success -->
        <div v-else-if="authStep === 2">
          <UAlert
            icon="i-heroicons-check-circle"
            color="green"
            title="Authentication successful!"
            :description="`Your BMW connection is established. GCID: ${settings?.gcid || 'unknown'}`"
          />
          <div class="flex gap-3 mt-3">
            <UButton
              variant="outline"
              icon="i-heroicons-arrow-path"
              :loading="refreshingTokens"
              @click="refreshTokens"
            >
              Refresh tokens manually
            </UButton>
            <UButton variant="ghost" @click="authStep = 0">
              Reconnect
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <!-- MQTT Configuration -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-gray-900 dark:text-white">MQTT Configuration</h2>
          <MqttStatusBadge :show-reconnect="true" />
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="saveMqttSettings">
        <div class="grid md:grid-cols-2 gap-4">
          <UFormField label="MQTT Host" class="w-full">
            <UInput v-model="mqttForm.mqttHost" placeholder="mqtt.bmwgroup.com" class="w-full font-mono" />
          </UFormField>
          <UFormField label="MQTT Port" class="w-full">
            <UInput v-model="mqttForm.mqttPort" type="number" placeholder="8883" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="MQTT Username (GCID)" class="w-full">
          <UInput v-model="mqttForm.mqttUsername" placeholder="Your GCID from the BMW portal" class="w-full font-mono" />
          <template #hint>
            <span class="text-xs text-gray-500">Set automatically after authentication</span>
          </template>
        </UFormField>

        <UFormField label="MQTT Topic Pattern" class="w-full">
          <UInput v-model="mqttForm.mqttTopicPattern" placeholder="GCID_abc123/#" class="w-full font-mono" />
          <template #hint>
            <span class="text-xs text-gray-500">
              e.g. "GCID_abc123/#" for all vehicles — use # (multi-level wildcard) as BMW topics are 3 levels deep
            </span>
          </template>
        </UFormField>

        <div class="flex justify-end gap-3">
          <UButton
            variant="outline"
            icon="i-heroicons-signal"
            :loading="reconnecting"
            type="button"
            @click="reconnectMqtt"
          >
            Reconnect
          </UButton>
          <UButton type="submit" :loading="savingMqtt">
            Save
          </UButton>
        </div>
      </form>
    </UCard>

    <!-- General Settings -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-gray-900 dark:text-white">General Settings</h2>
      </template>

      <form class="space-y-4" @submit.prevent="saveGeneralSettings">
        <UFormField label="Default driver name" class="w-full">
          <UInput v-model="generalForm.defaultDriver" placeholder="John Doe" class="w-full" />
          <template #hint>
            <span class="text-xs text-gray-500">Automatically assigned to new trips</span>
          </template>
        </UFormField>

        <div class="flex justify-end">
          <UButton type="submit" :loading="savingGeneral">Save</UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const toast = useToast()

const { data: settings, refresh: refreshSettings } = await useFetch('/api/settings')

const authStep = ref(0)
const startingAuth = ref(false)
const polling = ref(false)
const pollError = ref('')
const refreshingTokens = ref(false)
const deviceCodeData = ref<{
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
  code_verifier?: string
} | null>(null)

if (settings.value?.hasAccessToken) {
  authStep.value = 2
}

const authForm = reactive({
  clientId: settings.value?.bmwClientId || '',
})

const authStatusClass = computed(() => {
  if (settings.value?.hasAccessToken) {
    const exp = settings.value?.accessTokenExpiry
    if (exp && new Date(exp) > new Date()) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  }
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
})

const authDotClass = computed(() => {
  if (settings.value?.hasAccessToken) {
    const exp = settings.value?.accessTokenExpiry
    if (exp && new Date(exp) > new Date()) return 'bg-green-500'
    return 'bg-yellow-500'
  }
  return 'bg-gray-400'
})

const authStatusText = computed(() => {
  if (!settings.value?.hasAccessToken) return 'Not connected'
  const exp = settings.value?.accessTokenExpiry
  if (exp && new Date(exp) < new Date()) return 'Token expired'
  return 'Connected'
})

function tokenExpiryClass(expiry: string | Date | null | undefined): string {
  if (!expiry) return 'text-gray-400'
  const d = new Date(expiry as string)
  const now = new Date()
  if (d < now) return 'text-red-500'
  if (d.getTime() - now.getTime() < 30 * 60 * 1000) return 'text-yellow-500'
  return 'text-green-600 dark:text-green-400'
}

function tokenExpiryText(expiry: string | Date | null | undefined): string {
  if (!expiry) return '–'
  const d = new Date(expiry as string)
  const now = new Date()
  if (d < now) return `Expired (${d.toLocaleString('en-US')})`
  const diffMs = d.getTime() - now.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  const diffD = Math.floor(diffH / 24)
  if (diffD > 1) return `Expires in ${diffD} days`
  if (diffH > 0) return `Expires in ${diffH} hours`
  const diffMin = Math.floor(diffMs / (1000 * 60))
  return `Expires in ${diffMin} minutes`
}

const storedCodeVerifier = ref('')

async function startDeviceCodeFlow() {
  if (!authForm.clientId) return
  startingAuth.value = true
  pollError.value = ''
  try {
    const result = await $fetch<any>('/api/auth/device-code', {
      method: 'POST',
      body: { clientId: authForm.clientId },
    })
    deviceCodeData.value = result
    authStep.value = 1
    if (result.code_verifier) {
      storedCodeVerifier.value = result.code_verifier
    }
    startAutoPoll()
  } catch (err: any) {
    toast.add({ title: 'Error: ' + (err.data?.message || err.message), color: 'red' })
  } finally {
    startingAuth.value = false
  }
}

let pollInterval: ReturnType<typeof setInterval> | null = null

function startAutoPoll() {
  if (pollInterval) clearInterval(pollInterval)
  const interval = (deviceCodeData.value?.interval || 5) * 1000
  pollInterval = setInterval(async () => {
    const result = await pollToken()
    if (result === 'success' || result === 'expired') {
      if (pollInterval) clearInterval(pollInterval)
    }
  }, interval + 1000)
}

async function pollToken(): Promise<string> {
  if (!deviceCodeData.value) return 'no_data'
  polling.value = true
  pollError.value = ''
  try {
    const result = await $fetch<any>('/api/auth/token', {
      method: 'POST',
      body: {
        device_code: deviceCodeData.value.device_code,
        code_verifier: storedCodeVerifier.value || deviceCodeData.value.code_verifier,
      },
    })
    if (result.status === 'success') {
      authStep.value = 2
      await refreshSettings()
      toast.add({ title: 'Successfully connected!', icon: 'i-heroicons-check-circle', color: 'green' })
      return 'success'
    } else if (result.status === 'expired') {
      pollError.value = 'Code expired. Please restart.'
      return 'expired'
    }
    return 'pending'
  } catch (err: any) {
    pollError.value = err.data?.message || err.message || 'Verification failed'
    return 'error'
  } finally {
    polling.value = false
  }
}

function cancelAuth() {
  if (pollInterval) clearInterval(pollInterval)
  authStep.value = 0
  deviceCodeData.value = null
  storedCodeVerifier.value = ''
  pollError.value = ''
}

async function refreshTokens() {
  refreshingTokens.value = true
  try {
    await $fetch('/api/auth/refresh', { method: 'POST' })
    await refreshSettings()
    toast.add({ title: 'Tokens refreshed', color: 'green' })
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'red' })
  } finally {
    refreshingTokens.value = false
  }
}

function copyCode(code: string) {
  navigator.clipboard.writeText(code).then(() => {
    toast.add({ title: 'Code copied', icon: 'i-heroicons-clipboard-document-check' })
  })
}

const mqttForm = reactive({
  mqttHost: settings.value?.mqttHost || '',
  mqttPort: settings.value?.mqttPort || 8883,
  mqttUsername: settings.value?.mqttUsername || '',
  mqttTopicPattern: settings.value?.mqttTopicPattern || '',
})

watch(settings, (s) => {
  if (s) {
    mqttForm.mqttHost = s.mqttHost || ''
    mqttForm.mqttPort = s.mqttPort || 8883
    mqttForm.mqttUsername = s.mqttUsername || ''
    mqttForm.mqttTopicPattern = s.mqttTopicPattern || ''
    generalForm.defaultDriver = s.defaultDriver || ''
    authForm.clientId = s.bmwClientId || ''
    if (s.hasAccessToken && authStep.value === 0) authStep.value = 2
  }
})

const savingMqtt = ref(false)
const reconnecting = ref(false)

async function saveMqttSettings() {
  savingMqtt.value = true
  try {
    await $fetch('/api/settings', {
      method: 'PUT',
      body: {
        mqttHost: mqttForm.mqttHost,
        mqttPort: Number(mqttForm.mqttPort),
        mqttUsername: mqttForm.mqttUsername,
        mqttTopicPattern: mqttForm.mqttTopicPattern,
      },
    })
    await refreshSettings()
    toast.add({ title: 'MQTT settings saved', color: 'green' })
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'red' })
  } finally {
    savingMqtt.value = false
  }
}

async function reconnectMqtt() {
  reconnecting.value = true
  try {
    await $fetch('/api/mqtt/reconnect', { method: 'POST' })
    toast.add({ title: 'MQTT reconnecting...', color: 'green' })
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'red' })
  } finally {
    reconnecting.value = false
  }
}

const generalForm = reactive({
  defaultDriver: settings.value?.defaultDriver || '',
})

const savingGeneral = ref(false)

async function saveGeneralSettings() {
  savingGeneral.value = true
  try {
    await $fetch('/api/settings', {
      method: 'PUT',
      body: { defaultDriver: generalForm.defaultDriver },
    })
    await refreshSettings()
    toast.add({ title: 'Settings saved', color: 'green' })
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'red' })
  } finally {
    savingGeneral.value = false
  }
}

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>
