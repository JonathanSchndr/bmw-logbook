import mqtt from 'mqtt'
import { connectDB } from '../utils/db'
import { SettingsModel } from '../models/Settings'
import { RawEventModel } from '../models/RawEvent'
import { processEvent } from '../utils/trip-detector'

interface MqttState {
  client: mqtt.MqttClient | null
  connected: boolean
  connecting: boolean
  error: string | null
  lastConnectedAt: Date | null
}

const mqttState: MqttState = {
  client: null,
  connected: false,
  connecting: false,
  error: null,
  lastConnectedAt: null,
}

// Set to true during intentional disconnect to suppress the close→scheduleReconnect path.
// Stays true until the new mqtt.connect() is called so that async close events from
// the old client (which arrive after disconnectMqtt() returns) are still ignored.
let intentionalDisconnect = false

// Rate-limit guard: track when the last connection attempt was made
let lastConnectionAttemptAt = 0
const MIN_CONNECTION_INTERVAL_MS = 30_000 // never attempt more than once per 30 s

export function getMqttStatus() {
  return {
    connected: mqttState.connected,
    connecting: mqttState.connecting,
    error: mqttState.error,
    lastConnectedAt: mqttState.lastConnectedAt,
  }
}

async function refreshTokens(): Promise<boolean> {
  try {
    const settings = await SettingsModel.findOne()
    if (!settings || !settings.refreshToken || !settings.bmwClientId) return false

    const now = new Date()
    if (settings.refreshTokenExpiry && settings.refreshTokenExpiry < now) {
      console.warn('[MQTT] Refresh token has expired, cannot refresh')
      return false
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: settings.refreshToken,
      client_id: settings.bmwClientId,
    })

    const response = await fetch('https://customer.bmwgroup.com/gcdm/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[MQTT] Token refresh failed:', response.status, text)
      return false
    }

    const data = await response.json() as any

    const accessExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000)
    const idExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000)
    const refreshExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    settings.accessToken = data.access_token
    settings.accessTokenExpiry = accessExpiry
    settings.idToken = data.id_token
    settings.idTokenExpiry = idExpiry
    if (data.refresh_token) {
      settings.refreshToken = data.refresh_token
      settings.refreshTokenExpiry = refreshExpiry
    }

    await settings.save()
    console.log('[MQTT] Tokens refreshed successfully')
    return true
  } catch (err) {
    console.error('[MQTT] Error refreshing tokens:', err)
    return false
  }
}

// Tears down the existing client without triggering the auto-reconnect path.
// intentionalDisconnect stays true until the caller creates the new connection.
async function disconnectMqtt(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  intentionalDisconnect = true
  if (mqttState.client) {
    try {
      mqttState.client.end(true)
    } catch (_) {}
    mqttState.client = null
  }
  mqttState.connected = false
  mqttState.connecting = false
  // intentionalDisconnect is NOT reset here — it stays true until just before
  // mqtt.connect() is called, so any async close events on the old client are ignored.
}

export async function reconnectMQTT(): Promise<void> {
  console.log('[MQTT] Reconnect requested')
  await disconnectMqtt()

  try {
    await connectDB()
    const settings = await SettingsModel.findOne()

    if (!settings || !settings.mqttHost || !settings.mqttUsername || !settings.idToken) {
      const missing = []
      if (!settings) missing.push('settings document')
      else {
        if (!settings.mqttHost) missing.push('mqttHost')
        if (!settings.mqttUsername) missing.push('mqttUsername (GCID)')
        if (!settings.idToken) missing.push('idToken (not authenticated yet)')
      }
      console.log('[MQTT] Missing configuration:', missing.join(', '))
      intentionalDisconnect = false
      return
    }

    // Refresh if idToken is expiring within 15 minutes or already expired
    if (settings.idTokenExpiry) {
      const expiresInMs = settings.idTokenExpiry.getTime() - Date.now()
      if (expiresInMs < 15 * 60 * 1000) {
        console.log('[MQTT] ID token expiring soon, refreshing...')
        const refreshed = await refreshTokens()
        if (!refreshed) {
          mqttState.error = 'Token refresh failed'
          intentionalDisconnect = false
          return
        }
        const updatedSettings = await SettingsModel.findOne()
        if (!updatedSettings?.idToken) {
          intentionalDisconnect = false
          return
        }
        settings.idToken = updatedSettings.idToken
        settings.idTokenExpiry = updatedSettings.idTokenExpiry
      }
    }

    // Rate-limit guard: enforce minimum interval between connection attempts
    const msSinceLast = Date.now() - lastConnectionAttemptAt
    if (msSinceLast < MIN_CONNECTION_INTERVAL_MS) {
      const wait = MIN_CONNECTION_INTERVAL_MS - msSinceLast
      console.log(`[MQTT] Rate-limit guard: waiting ${Math.round(wait / 1000)}s before connecting`)
      await new Promise(resolve => setTimeout(resolve, wait))
    }

    mqttState.connecting = true
    mqttState.error = null
    lastConnectionAttemptAt = Date.now()

    const brokerUrl = `mqtts://${settings.mqttHost}:${settings.mqttPort || 8883}`

    let topic = settings.mqttTopicPattern || `${settings.mqttUsername}/#`
    if (topic && !topic.includes('#') && !topic.endsWith('+')) {
      topic = `${topic}/#`
    }

    console.log(`[MQTT] Connecting to ${brokerUrl}, topic: ${topic}`)

    // Reset the flag just before creating the new client so that close events
    // on the NEW connection correctly trigger auto-reconnect.
    intentionalDisconnect = false

    const client = mqtt.connect(brokerUrl, {
      username: settings.mqttUsername,
      password: settings.idToken,
      clientId: `logbook_${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 0, // We handle reconnection ourselves
      connectTimeout: 30000,
      keepalive: 25,
      protocolVersion: 4,
    })

    mqttState.client = client

    client.on('connect', () => {
      console.log('[MQTT] Connected to broker')
      mqttState.connected = true
      mqttState.connecting = false
      mqttState.lastConnectedAt = new Date()
      mqttState.error = null
      reconnectAttempts = 0

      client.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          console.error('[MQTT] Subscribe error:', err)
          mqttState.error = err.message
        } else {
          console.log(`[MQTT] Subscribed to ${topic}`)
        }
      })
    })

    client.on('message', async (receivedTopic: string, message: Buffer) => {
      try {
        const payload = message.toString()
        const raw = JSON.parse(payload)

        // BMW CarData format:
        // { vin, entityId, topic, timestamp, data: { "event.name": { value, unit, timestamp } } }
        // The "data" object can contain multiple events per message.

        const vin: string | null = raw.vin?.toUpperCase() ?? null
        if (!vin) {
          console.debug('[MQTT] No VIN in payload, topic:', receivedTopic)
          return
        }

        const dataEntries = Object.entries(raw.data ?? {})
        if (dataEntries.length === 0) {
          console.debug('[MQTT] Empty data object, topic:', receivedTopic)
          return
        }

        // Log all incoming events for diagnostics
        for (const [eventName, eventPayload] of dataEntries) {
          const ep = eventPayload as any
          console.log(`[MQTT RAW] ${eventName} = ${ep?.value} ${ep?.unit ?? ''}`)
        }

        for (const [eventName, eventPayload] of dataEntries) {
          const ep = eventPayload as any
          const value = ep?.value
          if (value === undefined || value === null) continue

          const eventTimestamp = ep.timestamp ? new Date(ep.timestamp) : new Date(raw.timestamp ?? Date.now())
          const valueStr = String(value)
          const unit = ep.unit ?? ''

          const rawEvent = new RawEventModel({
            vin,
            name: eventName,
            timestamp: eventTimestamp,
            unit,
            value: valueStr,
            receivedAt: new Date(),
          })
          await rawEvent.save()

          await processEvent(vin, eventName, valueStr, eventTimestamp)
        }
      } catch (err) {
        console.error('[MQTT] Error processing message:', err)
      }
    })

    client.on('error', (err: Error) => {
      console.error('[MQTT] Client error:', err.message)
      mqttState.error = err.message
      mqttState.connected = false
      mqttState.connecting = false
    })

    client.on('close', () => {
      mqttState.connected = false
      mqttState.connecting = false
      if (!intentionalDisconnect) {
        console.log('[MQTT] Connection closed unexpectedly — scheduling reconnect')
        scheduleReconnect()
      }
    })

    client.on('offline', () => {
      console.log('[MQTT] Client offline')
      mqttState.connected = false
    })
  } catch (err: any) {
    console.error('[MQTT] Connection error:', err)
    mqttState.error = err.message
    mqttState.connecting = false
    mqttState.connected = false
    intentionalDisconnect = false
  }
}

// Auto-reconnect on unexpected disconnect
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
let reconnecting = false // prevents two concurrent reconnect attempts

function scheduleReconnect(): void {
  // Don't stack up timers or start while one is already running
  if (reconnectTimer || reconnecting) return
  // Don't reconnect if a connection attempt is already in progress
  if (mqttState.connecting) return

  // Exponential backoff: 30s, 60s — respects BMW's 1-minute rate-limit window
  const delay = Math.min(30000 * Math.pow(2, reconnectAttempts), 60000)
  reconnectAttempts++
  console.log(`[MQTT] Reconnect scheduled in ${delay / 1000}s (attempt ${reconnectAttempts})`)

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    if (mqttState.connected || reconnecting) return

    reconnecting = true
    console.log('[MQTT] Auto-reconnecting...')
    try {
      await connectDB()
      const settings = await SettingsModel.findOne()
      if (!settings?.mqttHost || !settings?.mqttUsername) return

      await reconnectMQTT()
    } catch (err) {
      console.error('[MQTT] Auto-reconnect failed:', err)
      scheduleReconnect()
    } finally {
      reconnecting = false
    }
  }, delay)
}

// Periodic token refresh — runs every minute, refreshes 15 min before expiry
let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null

async function startTokenRefreshLoop(): Promise<void> {
  if (tokenRefreshInterval) return

  tokenRefreshInterval = setInterval(async () => {
    try {
      await connectDB()
      const settings = await SettingsModel.findOne()
      if (!settings || !settings.idToken || !settings.idTokenExpiry) return

      const expiresInMs = settings.idTokenExpiry.getTime() - Date.now()
      if (expiresInMs < 15 * 60 * 1000) {
        console.log(`[MQTT] ID token expiring in ${Math.round(expiresInMs / 1000)}s, refreshing`)
        const refreshed = await refreshTokens()
        // Only reconnect if currently connected and no reconnect is already in flight
        if (refreshed && mqttState.connected && !mqttState.connecting && !reconnectTimer) {
          await reconnectMQTT()
        }
      }
    } catch (err) {
      console.error('[MQTT] Token refresh loop error:', err)
    }
  }, 60 * 1000)
}

export default defineNitroPlugin(async () => {
  console.log('[MQTT Plugin] Initializing...')

  try {
    await connectDB()
    const settings = await SettingsModel.findOne()

    if (settings && settings.mqttHost && settings.mqttUsername && settings.idToken) {
      console.log('[MQTT Plugin] Found settings, attempting MQTT connection')
      await reconnectMQTT()
    } else {
      console.log('[MQTT Plugin] No MQTT settings found, skipping connection')
    }
  } catch (err) {
    console.error('[MQTT Plugin] Startup error:', err)
  }

  await startTokenRefreshLoop()
  console.log('[MQTT Plugin] Token refresh loop started')
})
