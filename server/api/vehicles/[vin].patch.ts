import { connectDB } from '../../utils/db'
import { VehicleModel } from '../../models/Vehicle'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const vin = getRouterParam(event, 'vin')?.toUpperCase()
    if (!vin) throw createError({ statusCode: 400, message: 'VIN is required' })

    const body = await readBody(event) as {
      licensePlate?: string
      make?: string
      model?: string
      year?: number
      color?: string
      mqttTopic?: string
      isActive?: boolean
    }

    const vehicle = await VehicleModel.findOne({ vin })
    if (!vehicle) throw createError({ statusCode: 404, message: 'Vehicle not found' })

    if (body.licensePlate !== undefined) vehicle.licensePlate = body.licensePlate
    if (body.make !== undefined) vehicle.make = body.make
    if (body.model !== undefined) (vehicle as any).model = body.model
    if (body.year !== undefined) vehicle.year = body.year
    if (body.color !== undefined) vehicle.color = body.color
    if (body.mqttTopic !== undefined) vehicle.mqttTopic = body.mqttTopic
    if (body.isActive !== undefined) vehicle.isActive = body.isActive

    await vehicle.save()
    return vehicle.toObject()
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
