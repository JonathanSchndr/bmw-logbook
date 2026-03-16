import { connectDB } from '../../utils/db'
import { TripModel } from '../../models/Trip'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const body = await readBody(event) as {
      vin: string
      startTime: string
      endTime?: string
      startAddress?: string
      endAddress?: string
      distanceKm?: number
      purpose?: string
      businessDestination?: string
      businessContact?: string
      notes?: string
      driver?: string
      startOdometer?: number
      endOdometer?: number
    }

    if (!body?.vin) throw createError({ statusCode: 400, message: 'VIN is required' })
    if (!body?.startTime) throw createError({ statusCode: 400, message: 'startTime is required' })

    const trip = new TripModel({
      vin: body.vin.toUpperCase(),
      startTime: new Date(body.startTime),
      endTime: body.endTime ? new Date(body.endTime) : null,
      startAddress: body.startAddress || '',
      endAddress: body.endAddress || '',
      distanceKm: body.distanceKm || 0,
      purpose: body.purpose || 'unclassified',
      businessDestination: body.businessDestination || '',
      businessContact: body.businessContact || '',
      notes: body.notes || '',
      driver: body.driver || '',
      startOdometer: body.startOdometer || null,
      endOdometer: body.endOdometer || null,
      status: 'manual',
      waypoints: [],
    })

    await trip.save()
    return trip.toObject()
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
