import mongoose, { Schema, type Document } from 'mongoose'

export interface IWaypoint {
  lat: number
  lng: number
  timestamp: Date
}

export interface ITrip extends Document {
  vin: string
  startTime: Date
  endTime: Date | null
  startOdometer: number | null
  endOdometer: number | null
  distanceKm: number
  startAddress: string
  endAddress: string
  startLocation: { lat: number; lng: number } | null
  endLocation: { lat: number; lng: number } | null
  waypoints: IWaypoint[]
  purpose: 'business' | 'private' | 'unclassified'
  businessDestination: string
  businessContact: string
  notes: string
  driver: string
  status: 'in_progress' | 'completed' | 'manual'
}

const WaypointSchema = new Schema<IWaypoint>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false },
)

const LocationSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
)

const TripSchema = new Schema<ITrip>(
  {
    vin: { type: String, required: true, uppercase: true, trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    startOdometer: { type: Number, default: null },
    endOdometer: { type: Number, default: null },
    distanceKm: { type: Number, default: 0 },
    startAddress: { type: String, default: '' },
    endAddress: { type: String, default: '' },
    startLocation: { type: LocationSchema, default: null },
    endLocation: { type: LocationSchema, default: null },
    waypoints: { type: [WaypointSchema], default: [] },
    purpose: {
      type: String,
      enum: ['business', 'private', 'unclassified'],
      default: 'unclassified',
    },
    businessDestination: { type: String, default: '' },
    businessContact: { type: String, default: '' },
    notes: { type: String, default: '' },
    driver: { type: String, default: '' },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'manual'],
      default: 'in_progress',
    },
  },
  { timestamps: true },
)

TripSchema.index({ vin: 1, startTime: -1 })

export const TripModel =
  (mongoose.models.Trip as mongoose.Model<ITrip>) ||
  mongoose.model<ITrip>('Trip', TripSchema)
