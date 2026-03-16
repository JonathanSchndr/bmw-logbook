import mongoose, { Schema, type Document } from 'mongoose'

export interface ISettings extends Document {
  bmwClientId: string
  gcid: string
  accessToken: string
  accessTokenExpiry: Date | null
  refreshToken: string
  refreshTokenExpiry: Date | null
  idToken: string
  idTokenExpiry: Date | null
  mqttHost: string
  mqttPort: number
  mqttUsername: string
  mqttTopicPattern: string
  defaultDriver: string
}

const SettingsSchema = new Schema<ISettings>(
  {
    bmwClientId: { type: String, default: '' },
    gcid: { type: String, default: '' },
    accessToken: { type: String, default: '' },
    accessTokenExpiry: { type: Date, default: null },
    refreshToken: { type: String, default: '' },
    refreshTokenExpiry: { type: Date, default: null },
    idToken: { type: String, default: '' },
    idTokenExpiry: { type: Date, default: null },
    mqttHost: { type: String, default: '' },
    mqttPort: { type: Number, default: 8883 },
    mqttUsername: { type: String, default: '' },
    mqttTopicPattern: { type: String, default: '' },
    defaultDriver: { type: String, default: '' },
  },
  { timestamps: true },
)

export const SettingsModel =
  (mongoose.models.Settings as mongoose.Model<ISettings>) ||
  mongoose.model<ISettings>('Settings', SettingsSchema)
