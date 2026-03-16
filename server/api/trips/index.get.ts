import { connectDB } from '../../utils/db'
import { TripModel } from '../../models/Trip'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const query = getQuery(event) as {
      vin?: string
      year?: string
      month?: string
      purpose?: string
      status?: string
      page?: string
      limit?: string
    }

    const filter: Record<string, any> = {}

    if (query.vin) filter.vin = query.vin.toUpperCase()
    if (query.purpose) filter.purpose = query.purpose
    if (query.status) filter.status = query.status

    if (query.year) {
      const year = parseInt(query.year)
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      filter.startTime = { $gte: start, $lt: end }
    }

    if (query.month && query.year) {
      const year = parseInt(query.year)
      const month = parseInt(query.month) - 1 // 0-indexed
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 1)
      filter.startTime = { $gte: start, $lt: end }
    }

    const page = Math.max(1, parseInt(query.page || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')))
    const skip = (page - 1) * limit

    const [trips, total] = await Promise.all([
      TripModel.find(filter)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit)
        .select('-waypoints') // Exclude waypoints from list view for performance
        .lean(),
      TripModel.countDocuments(filter),
    ])

    return {
      trips,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
