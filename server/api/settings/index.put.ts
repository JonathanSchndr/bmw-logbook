import { connectDB } from '../../utils/db'
import { SettingsModel } from '../../models/Settings'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const body = await readBody(event) as {
      mqttHost?: string
      mqttPort?: number
      mqttUsername?: string
      mqttTopicPattern?: string
      defaultDriver?: string
      bmwClientId?: string
      gcid?: string
    }

    let settings = await SettingsModel.findOne()
    if (!settings) {
      settings = new SettingsModel()
    }

    if (body.mqttHost !== undefined) settings.mqttHost = body.mqttHost.trim()
    if (body.mqttPort !== undefined) settings.mqttPort = Number(body.mqttPort)
    if (body.mqttUsername !== undefined) settings.mqttUsername = body.mqttUsername.trim()
    if (body.mqttTopicPattern !== undefined) settings.mqttTopicPattern = body.mqttTopicPattern.trim()
    if (body.defaultDriver !== undefined) settings.defaultDriver = body.defaultDriver.trim()
    if (body.bmwClientId !== undefined) settings.bmwClientId = body.bmwClientId.trim()
    if (body.gcid !== undefined) {
      settings.gcid = body.gcid.trim()
      // If mqttUsername is not separately set, use gcid
      if (!settings.mqttUsername) settings.mqttUsername = body.gcid.trim()
    }

    await settings.save()

    // Trigger MQTT reconnect
    try {
      const { reconnectMQTT } = await import('../../plugins/01.mqtt')
      await reconnectMQTT()
    } catch (err) {
      console.warn('[Settings] Could not trigger MQTT reconnect:', err)
    }

    return {
      success: true,
      bmwClientId: settings.bmwClientId,
      gcid: settings.gcid,
      accessTokenExpiry: settings.accessTokenExpiry,
      refreshTokenExpiry: settings.refreshTokenExpiry,
      idTokenExpiry: settings.idTokenExpiry,
      mqttHost: settings.mqttHost,
      mqttPort: settings.mqttPort,
      mqttUsername: settings.mqttUsername,
      mqttTopicPattern: settings.mqttTopicPattern,
      defaultDriver: settings.defaultDriver,
      hasAccessToken: !!settings.accessToken,
      hasRefreshToken: !!settings.refreshToken,
      hasIdToken: !!settings.idToken,
    }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
