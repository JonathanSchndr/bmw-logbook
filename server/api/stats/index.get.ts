import { connectDB } from '../../utils/db'
import { TripModel } from '../../models/Trip'
import { tzLocalMidnightUTC, tzCurrentYearMonth } from '../../utils/timezone'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const query = getQuery(event) as { vin?: string; year?: string }

    const filter: Record<string, any> = { status: { $ne: 'in_progress' } }

    if (query.vin) filter.vin = query.vin.toUpperCase()

    const tz = useRuntimeConfig().timezone as string

    let year: number | null = null
    if (query.year) {
      year = parseInt(query.year)
      filter.startTime = {
        $gte: tzLocalMidnightUTC(year, 0, 1, tz),
        $lt: tzLocalMidnightUTC(year + 1, 0, 1, tz),
      }
    }

    const trips = await TripModel.find(filter).select('purpose distanceKm startTime').lean()

    const totalTrips = trips.length
    const totalKm = trips.reduce((sum, t) => sum + (t.distanceKm || 0), 0)
    const businessKm = trips
      .filter(t => t.purpose === 'business')
      .reduce((sum, t) => sum + (t.distanceKm || 0), 0)
    const privateKm = trips
      .filter(t => t.purpose === 'private')
      .reduce((sum, t) => sum + (t.distanceKm || 0), 0)
    const unclassifiedTrips = trips.filter(t => t.purpose === 'unclassified').length
    const avgTripKm = totalTrips > 0 ? totalKm / totalTrips : 0

    const { year: curYear, month: curMonth } = tzCurrentYearMonth(tz)
    const monthStart = tzLocalMidnightUTC(curYear, curMonth, 1, tz)
    const tripsThisMonth = trips.filter(t => new Date(t.startTime) >= monthStart)
    const thisMonthKm = tripsThisMonth.reduce((sum, t) => sum + (t.distanceKm || 0), 0)

    return {
      totalTrips,
      totalKm: Math.round(totalKm * 10) / 10,
      businessKm: Math.round(businessKm * 10) / 10,
      privateKm: Math.round(privateKm * 10) / 10,
      avgTripKm: Math.round(avgTripKm * 10) / 10,
      unclassifiedTrips,
      thisMonthKm: Math.round(thisMonthKm * 10) / 10,
      tripsThisMonth: tripsThisMonth.length,
    }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
