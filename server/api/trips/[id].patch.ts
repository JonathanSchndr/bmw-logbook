import { connectDB } from '../../utils/db'
import { TripModel } from '../../models/Trip'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'Trip ID is required' })

    const body = await readBody(event) as {
      purpose?: string
      notes?: string
      driver?: string
      startAddress?: string
      endAddress?: string
      distanceKm?: number
      startTime?: string
      endTime?: string
      startOdometer?: number
      endOdometer?: number
    }

    const trip = await TripModel.findById(id)
    if (!trip) throw createError({ statusCode: 404, message: 'Trip not found' })

    if (body.purpose !== undefined) trip.purpose = body.purpose as any
    if (body.notes !== undefined) trip.notes = body.notes
    if (body.driver !== undefined) trip.driver = body.driver
    if (body.startAddress !== undefined) trip.startAddress = body.startAddress
    if (body.endAddress !== undefined) trip.endAddress = body.endAddress
    if (body.distanceKm !== undefined) trip.distanceKm = body.distanceKm
    if (body.startTime !== undefined) trip.startTime = new Date(body.startTime)
    if (body.endTime !== undefined) trip.endTime = new Date(body.endTime)
    if (body.startOdometer !== undefined) trip.startOdometer = body.startOdometer
    if (body.endOdometer !== undefined) trip.endOdometer = body.endOdometer

    await trip.save()
    return trip.toObject()
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
