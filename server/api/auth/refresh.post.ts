import { connectDB } from '../../utils/db'
import { SettingsModel } from '../../models/Settings'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const settings = await SettingsModel.findOne()
    if (!settings || !settings.refreshToken || !settings.bmwClientId) {
      throw createError({ statusCode: 400, message: 'No refresh token available' })
    }

    const now = new Date()
    if (settings.refreshTokenExpiry && settings.refreshTokenExpiry < now) {
      throw createError({ statusCode: 401, message: 'Refresh token has expired, please re-authenticate' })
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: settings.refreshToken,
      client_id: settings.bmwClientId,
    })

    const response = await fetch('https://customer.bmwgroup.com/gcdm/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      throw createError({
        statusCode: response.status,
        message: `Token refresh failed: ${text}`,
      })
    }

    const data = await response.json() as any

    const nowMs = Date.now()
    const accessExpiry = new Date(nowMs + (data.expires_in || 3600) * 1000)
    const idExpiry = new Date(nowMs + (data.expires_in || 3600) * 1000)
    const refreshExpiry = new Date(nowMs + 14 * 24 * 60 * 60 * 1000)

    settings.accessToken = data.access_token
    settings.accessTokenExpiry = accessExpiry
    settings.idToken = data.id_token
    settings.idTokenExpiry = idExpiry
    if (data.refresh_token) {
      settings.refreshToken = data.refresh_token
      settings.refreshTokenExpiry = refreshExpiry
    }

    await settings.save()

    // Trigger MQTT reconnect with new idToken
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
      refreshTokenExpiry: settings.refreshTokenExpiry,
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
