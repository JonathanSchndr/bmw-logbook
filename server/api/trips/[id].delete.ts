import { connectDB } from '../../utils/db'
import { TripModel } from '../../models/Trip'

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, message: 'Trip ID is required' })

    const result = await TripModel.findByIdAndDelete(id)
    if (!result) throw createError({ statusCode: 404, message: 'Trip not found' })

    return { success: true, id }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
