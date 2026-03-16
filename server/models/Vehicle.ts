import mongoose, { Schema } from 'mongoose'

export interface IVehicle {
  vin: string
  licensePlate: string
  make: string
  model: string
  year: number
  color: string
  imageUrl: string
  mqttTopic: string
  isActive: boolean
  addedAt: Date
}

const VehicleSchema = new Schema<IVehicle>(
  {
    vin: { type: String, required: true, unique: true, trim: true, uppercase: true },
    licensePlate: { type: String, default: '', trim: true },
    make: { type: String, default: 'BMW', trim: true },
    model: { type: String, default: '', trim: true },
    year: { type: Number, default: null },
    color: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '' },
    mqttTopic: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export const VehicleModel =
  (mongoose.models.Vehicle as mongoose.Model<IVehicle>) ||
  mongoose.model<IVehicle>('Vehicle', VehicleSchema)
