import { connectDB } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    await connectDB()

    const { reconnectMQTT } = await import('../../plugins/01.mqtt')
    await reconnectMQTT()

    return { success: true, message: 'MQTT reconnect initiated' }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
