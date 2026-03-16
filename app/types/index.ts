export interface Settings {
  _id?: string
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

export interface SettingsPublic {
  _id?: string
  bmwClientId: string
  gcid: string
  accessTokenExpiry: Date | null
  refreshTokenExpiry: Date | null
  idTokenExpiry: Date | null
  mqttHost: string
  mqttPort: number
  mqttUsername: string
  mqttTopicPattern: string
  defaultDriver: string
  hasAccessToken: boolean
  hasRefreshToken: boolean
  hasIdToken: boolean
}

export interface Vehicle {
  _id?: string
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

export interface RawEvent {
  _id?: string
  vin: string
  name: string
  timestamp: Date
  unit: string
  value: string
  receivedAt: Date
}

export type TripPurpose = 'business' | 'private' | 'unclassified'
export type TripStatus = 'in_progress' | 'completed' | 'manual'

export interface Waypoint {
  lat: number
  lng: number
  timestamp: Date
}

export interface Trip {
  _id?: string
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
  waypoints: Waypoint[]
  purpose: TripPurpose
  businessDestination: string
  businessContact: string
  notes: string
  driver: string
  status: TripStatus
}

export interface TripStats {
  totalTrips: number
  totalKm: number
  businessKm: number
  privateKm: number
  avgTripKm: number
  unclassifiedTrips: number
  thisMonthKm: number
  tripsThisMonth: number
}

export interface MqttStatus {
  connected: boolean
  connecting: boolean
  error: string | null
  lastConnectedAt: Date | null
  clientId: string | null
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  id_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface BmwVehicleMapping {
  vin: string
  brand: string
  modelName: string
  year: number
  licensePlate: string
  mqttTopic?: string
}
