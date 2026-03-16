import { connectDB } from '../../utils/db'
import { SettingsModel } from '../../models/Settings'

export default defineEventHandler(async () => {
  try {
    await connectDB()

    const settings = await SettingsModel.findOne()
    if (!settings || !settings.accessToken) {
      throw createError({ statusCode: 401, message: 'Not authenticated with BMW API' })
    }

    // Check token expiry
    if (settings.accessTokenExpiry && settings.accessTokenExpiry < new Date()) {
      throw createError({ statusCode: 401, message: 'Access token expired, please refresh' })
    }

    const response = await fetch('https://api-cardata.bmwgroup.com/customers/vehicles/mappings', {
      headers: {
        Authorization: `Bearer ${settings.accessToken}`,
        Accept: 'application/json',
        'x-version': 'v1',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw createError({
        statusCode: response.status,
        message: `BMW API error: ${text}`,
      })
    }

    const data = await response.json() as any

    // Normalize the response format
    // BMW API may return various formats depending on subscription
    const mappings = Array.isArray(data) ? data : data.vehicles || data.mappings || []

    return {
      mappings: mappings.map((v: any) => ({
        vin: v.vin || v.VIN || '',
        brand: v.brand || v.make || 'BMW',
        modelName: v.modelName || v.model || v.carLine || '',
        year: v.year || v.modelYear || null,
        licensePlate: v.licensePlate || v.numberPlate || '',
        mqttTopic: v.mqttTopic || v.streamingTopic || '',
      })),
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
