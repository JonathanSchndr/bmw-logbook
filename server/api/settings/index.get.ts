import { connectDB } from '../../utils/db'
import { SettingsModel } from '../../models/Settings'

export default defineEventHandler(async () => {
  try {
    await connectDB()
    const settings = await SettingsModel.findOne().lean()

    if (!settings) {
      return {
        bmwClientId: '',
        gcid: '',
        accessTokenExpiry: null,
        refreshTokenExpiry: null,
        idTokenExpiry: null,
        mqttHost: '',
        mqttPort: 8883,
        mqttUsername: '',
        mqttTopicPattern: '',
        defaultDriver: '',
        hasAccessToken: false,
        hasRefreshToken: false,
        hasIdToken: false,
      }
    }

    // Never expose tokens in response
    return {
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
