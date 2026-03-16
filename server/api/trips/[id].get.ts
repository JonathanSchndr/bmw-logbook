import { connectDB } from '../../utils/db'
import { TripModel } from '../../models/Trip'
import { RawEventModel } from '../../models/RawEvent'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'Trip ID is required' })

    const trip = await TripModel.findById(id).lean()
    if (!trip) throw createError({ statusCode: 404, message: 'Trip not found' })

    // Get raw events for this trip's timeframe
    const query: Record<string, any> = {
      vin: trip.vin,
      timestamp: { $gte: trip.startTime },
    }
    if (trip.endTime) {
      query.timestamp.$lte = trip.endTime
    }

    const rawEvents = await RawEventModel.find(query)
      .sort({ timestamp: 1 })
      .limit(200)
      .lean()

    return { trip, rawEvents }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
