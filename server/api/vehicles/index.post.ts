import { connectDB } from '../../utils/db'
import { VehicleModel } from '../../models/Vehicle'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const body = await readBody(event) as {
      vin: string
      licensePlate?: string
      make?: string
      model?: string
      year?: number
      color?: string
      mqttTopic?: string
    }

    if (!body?.vin) {
      throw createError({ statusCode: 400, message: 'VIN is required' })
    }

    const vin = body.vin.trim().toUpperCase()

    const existing = await VehicleModel.findOne({ vin })
    if (existing) {
      throw createError({ statusCode: 409, message: `Vehicle with VIN ${vin} already exists` })
    }

    const vehicle = new VehicleModel({
      vin,
      licensePlate: body.licensePlate || '',
      make: body.make || 'BMW',
      model: body.model || '',
      year: body.year || null,
      color: body.color || '',
      mqttTopic: body.mqttTopic || '',
      isActive: true,
      addedAt: new Date(),
    })

    await vehicle.save()
    return vehicle.toObject()
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
