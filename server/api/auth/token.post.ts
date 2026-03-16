import { connectDB } from '../../utils/db'
import { SettingsModel } from '../../models/Settings'

// Shared pendingFlows store - in production use Redis or similar
// We use a module-level Map since nitro plugins share state
const pendingFlows = new Map<string, { codeVerifier: string; expiresAt: number }>()

export function getPendingFlows() {
  return pendingFlows
}

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const body = await readBody(event) as {
      device_code: string
      client_id?: string
      code_verifier?: string
    }

    if (!body?.device_code) {
      throw createError({ statusCode: 400, message: 'device_code is required' })
    }

    const settings = await SettingsModel.findOne()
    const clientId = body.client_id || settings?.bmwClientId

    if (!clientId) {
      throw createError({ statusCode: 400, message: 'client_id is required (or set in settings)' })
    }

    // Get code_verifier - either from request body or from our pendingFlows store
    // In a stateless approach, the client sends the code_verifier back
    const codeVerifier = body.code_verifier

    if (!codeVerifier) {
      throw createError({ statusCode: 400, message: 'code_verifier is required' })
    }

    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: body.device_code,
      client_id: clientId,
      code_verifier: codeVerifier,
    })

    const response = await fetch('https://customer.bmwgroup.com/gcdm/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    })

    const data = await response.json() as any

    if (!response.ok) {
      // authorization_pending means user hasn't authorized yet
      if (data.error === 'authorization_pending') {
        return { status: 'pending', error: data.error, error_description: data.error_description }
      }
      if (data.error === 'slow_down') {
        return { status: 'slow_down', error: data.error }
      }
      if (data.error === 'expired_token') {
        return { status: 'expired', error: data.error }
      }
      throw createError({
        statusCode: response.status,
        message: data.error_description || data.error || 'Token exchange failed',
      })
    }

    // Save tokens to settings
    let settingsDoc = await SettingsModel.findOne()
    if (!settingsDoc) {
      settingsDoc = new SettingsModel()
    }

    const now = Date.now()
    const accessExpiry = new Date(now + (data.expires_in || 3600) * 1000)
    const idExpiry = new Date(now + (data.expires_in || 3600) * 1000)
    const refreshExpiry = new Date(now + 14 * 24 * 60 * 60 * 1000)

    settingsDoc.accessToken = data.access_token
    settingsDoc.accessTokenExpiry = accessExpiry
    settingsDoc.idToken = data.id_token
    settingsDoc.idTokenExpiry = idExpiry
    settingsDoc.refreshToken = data.refresh_token
    settingsDoc.refreshTokenExpiry = refreshExpiry

    // Extract GCID from ID token (JWT payload)
    if (data.id_token) {
      try {
        const payload = JSON.parse(
          Buffer.from(data.id_token.split('.')[1], 'base64url').toString('utf-8'),
        )
        const gcid = payload.sub || payload.gcid || payload['custom:gcid'] || ''
        if (gcid) {
          settingsDoc.gcid = gcid
          settingsDoc.mqttUsername = gcid
        }
      } catch (_) {
        console.warn('[Auth] Could not parse ID token payload')
      }
    }

    await settingsDoc.save()

    // Trigger MQTT reconnect
    try {
      const { reconnectMQTT } = await import('../../plugins/01.mqtt')
      await reconnectMQTT()
    } catch (err) {
      console.warn('[Auth] Could not trigger MQTT reconnect:', err)
    }

    return {
      status: 'success',
      accessTokenExpiry: accessExpiry,
      idTokenExpiry: idExpiry,
      refreshTokenExpiry: refreshExpiry,
      gcid: settingsDoc.gcid,
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
