import mongoose from 'mongoose'

let isConnected = false

export async function connectDB(): Promise<void> {
  if (isConnected) return

  const config = useRuntimeConfig()
  const uri = config.mongodbUri

  if (!uri) {
    throw new Error('MONGODB_URI is not set')
  }

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
    })
    isConnected = true
    console.log('[DB] Connected to MongoDB')
  } catch (err) {
    console.error('[DB] MongoDB connection error:', err)
    throw err
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false
  console.warn('[DB] MongoDB disconnected')
})

mongoose.connection.on('error', (err) => {
  console.error('[DB] MongoDB error:', err)
})
