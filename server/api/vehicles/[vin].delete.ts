import { connectDB } from '../../utils/db'
import { VehicleModel } from '../../models/Vehicle'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const vin = getRouterParam(event, 'vin')?.toUpperCase()
    if (!vin) throw createError({ statusCode: 400, message: 'VIN is required' })

    const result = await VehicleModel.deleteOne({ vin })
    if (result.deletedCount === 0) {
      throw createError({ statusCode: 404, message: 'Vehicle not found' })
    }

    return { success: true, vin }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
