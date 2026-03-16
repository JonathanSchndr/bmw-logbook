import mongoose, { Schema, type Document } from 'mongoose'

export interface IRawEvent extends Document {
  vin: string
  name: string
  timestamp: Date
  unit: string
  value: string
  receivedAt: Date
}

const RawEventSchema = new Schema<IRawEvent>(
  {
    vin: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    timestamp: { type: Date, required: true },
    unit: { type: String, default: '' },
    value: { type: String, required: true },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

RawEventSchema.index({ vin: 1, timestamp: -1 })
RawEventSchema.index({ vin: 1, name: 1, timestamp: -1 })

export const RawEventModel =
  (mongoose.models.RawEvent as mongoose.Model<IRawEvent>) ||
  mongoose.model<IRawEvent>('RawEvent', RawEventSchema)
