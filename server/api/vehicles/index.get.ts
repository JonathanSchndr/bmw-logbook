import { connectDB } from '../../utils/db'
import { VehicleModel } from '../../models/Vehicle'

export default defineEventHandler(async () => {
  try {
    await connectDB()
    const vehicles = await VehicleModel.find().sort({ addedAt: -1 }).lean()
    return vehicles
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
