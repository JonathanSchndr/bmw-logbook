import { getMqttStatus } from '../../plugins/01.mqtt'

export default defineEventHandler(() => {
  try {
    const status = getMqttStatus()
    return status
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
