import { connectDB } from '../../../utils/db'
import { RawEventModel } from '../../../models/RawEvent'
import { VehicleModel } from '../../../models/Vehicle'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const vin = getRouterParam(event, 'vin')?.toUpperCase()
    if (!vin) throw createError({ statusCode: 400, message: 'VIN is required' })

    const vehicle = await VehicleModel.findOne({ vin }).lean()
    if (!vehicle) throw createError({ statusCode: 404, message: 'Vehicle not found' })

    // Get latest value for each unique telematic key
    const latestValues = await RawEventModel.aggregate([
      { $match: { vin } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$name',
          name: { $first: '$name' },
          value: { $first: '$value' },
          unit: { $first: '$unit' },
          timestamp: { $first: '$timestamp' },
        },
      },
      { $sort: { name: 1 } },
    ] as any[])

    // Organize by category
    const categories: Record<string, Array<{ name: string; value: string; unit: string; timestamp: Date }>> = {}

    for (const item of latestValues) {
      const parts = item.name.split('.')
      const category = parts.slice(0, 3).join('.') || 'other'
      if (!categories[category]) categories[category] = []
      categories[category].push({
        name: item.name,
        value: item.value,
        unit: item.unit,
        timestamp: item.timestamp,
      })
    }

    return {
      vin,
      vehicle,
      latestValues,
      categories,
      lastUpdate: latestValues.length > 0
        ? latestValues.reduce((latest, item) =>
          item.timestamp > latest ? item.timestamp : latest,
          new Date(0),
        )
        : null,
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
