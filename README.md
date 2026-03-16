# BMW Logbook – Digital Driving Log

A self-hosted digital driving logbook for BMW vehicles, compliant with German tax authority (Tax Office) requirements. Connects to BMW's CarData MQTT streaming API for real-time telematics and automatic trip detection.

---

## Features

- **Automatic trip detection** from real-time GPS/location events via MQTT
- **Real-time telematics** – live vehicle data dashboard
- **Trip management** – classify trips as business or private
- **Interactive maps** – view trip routes on OpenStreetMap (Leaflet)
- **Tax Office-compliant export** – CSV and print-ready HTML/PDF
- **Multi-vehicle support** – manage multiple BMW vehicles
- **German Tax Office requirements** – all required fields included
- **Automatic token refresh** – stays connected without manual intervention
- **Docker deployment** – easy setup with docker-compose
- **Dark/light mode**

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Nuxt 4 + @nuxt/ui + Tailwind CSS |
| Backend | Nuxt Nitro (Node.js) |
| Database | MongoDB + Mongoose |
| MQTT | mqtt npm package |
| Maps | Leaflet + OpenStreetMap |
| Auth | BMW OAuth 2.0 Device Code Flow + PKCE |
| Language | TypeScript |

---

## Quick Start (Docker)

```bash
# Clone the repository
git clone https://github.com/yourname/bmw-logbook.git
cd bmw-logbook

# Configure environment
cp .env.example .env
# Edit .env and set NUXT_SESSION_SECRET to a random string (min. 32 chars)

# Start all services
docker compose up -d

# Open in browser
open http://localhost:3000
```

---

## Manual Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- MongoDB 7.0+
- BMW CarData account with active subscriptions

### Installation

```bash
pnpm install
cp .env.example .env
# Configure MONGODB_URI and NUXT_SESSION_SECRET in .env

pnpm build
pnpm preview
```

For development:

```bash
pnpm dev
```

---

## Configuration

All BMW credentials are stored securely in MongoDB – never in environment variables or config files.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `NUXT_SESSION_SECRET` | Secret for session signing (min. 32 chars) | Yes |

### App Configuration (via Settings page)

| Setting | Description |
|---------|-------------|
| BMW CarData Client ID | From BMW customer portal |
| GCID | Your BMW account ID (auto-detected after auth) |
| MQTT Host | MQTT broker hostname |
| MQTT Port | MQTT broker port (typically 8883) |
| MQTT Topic Pattern | Topic to subscribe to (e.g., `GCID/+`) |
| Default Driver | Pre-filled driver name for new trips |

---

## Setup Guide

### Prerequisites

- Active BMW ConnectedDrive account with your vehicle mapped to it (you must be the **primary user** of the VIN)
- Vehicle with an active SIM card in a supported EU market
- Active ConnectedDrive contract

---

### Step 1: Generate your CarData Client ID and subscribe to services

1. Open the **My BMW** vehicle overview portal:
   - BMW: https://www.bmw.de/de-de/mybmw/vehicle-overview (or your country's equivalent)
   - Mini: https://www.mini.de/de_DE/home/mymini/vehicle-overview.html
2. Click **BMW CarData** in the vehicle section
3. Click **"Create CarData Client"** — this generates a unique Client ID. **Copy it**, you'll need it later.
4. Subscribe to both services by clicking the respective buttons:
   - **CarData API** → grants scope `cardata:api:read` (vehicle info, REST API)
   - **CarData Streaming** → grants scope `cardata:streaming:read` (real-time MQTT data)

> ⚠️ **Important:** You must subscribe to the services *before* running the Device Code Flow in the app. If you authenticate first and subscribe later, the tokens will not include the required scopes and you'll need to re-authenticate.

---

### Step 2: Configure your data stream and note down MQTT credentials

1. Still in the BMW CarData section of the portal, click **"Configure data stream"**
2. You'll see a list of all available telematic data keys. Select the ones you need:

   **Required for automatic trip tracking:**
   | Key | Description |
   |-----|-------------|
   | `vehicle.cabin.infotainment.navigation.currentLocation.latitude` | GPS latitude |
   | `vehicle.cabin.infotainment.navigation.currentLocation.longitude` | GPS longitude |

   **Recommended:**
   | Key | Description |
   |-----|-------------|
   | `vehicle.vehicle.travelledDistance` | Odometer in km |

   > The full list of available keys is in the **Telematics Data Catalogue (TDC)** linked in the portal.

3. After saving your key selection, the portal shows your **streaming credentials**:

   | Parameter | Description | Example |
   |-----------|-------------|---------|
   | **Host** | MQTT broker hostname | `mqtt.bmwgroup.com` |
   | **Port** | MQTT broker port | `8883` |
   | **Topic** | Vehicle-specific topic (VIN-based) | `gcid12345abc/WBAXXXXXXX` |
   | **Username** | Your GCID | `gcid12345abc` |

   > The **password** is your **ID token** (JWT) — the app obtains and refreshes this automatically.

---

### Step 3: Authenticate the app (Device Code Flow)

1. Open http://localhost:3000 and go to **Settings**
2. In the **BMW Authentication** section:
   - Enter the **Client ID** from Step 1
   - Click **"Start login"**
   - A short code is displayed — open the shown URL in your browser, log in with your BMW credentials, and enter the code
   - The app polls automatically and saves the tokens once you've authorized
3. After successful authentication, the **GCID** field is filled in automatically

---

### Step 4: Configure MQTT in the app

1. Still in **Settings**, fill in the **MQTT Configuration** section using the streaming credentials from Step 2:
   - **MQTT Host** – broker hostname from the portal
   - **MQTT Port** – typically `8883`
   - **MQTT Username (GCID)** – your GCID as shown in the portal
   - **MQTT Topic Pattern** – use `your-gcid/#` to receive all data for all your vehicles
2. Click **Save**, then **Reconnect**
3. The status badge should turn green (Connected)

> **Note:** BMW allows only **one active MQTT connection per GCID** at a time. If you connect from multiple devices, the previous connection will be dropped.

---

### Step 5: Add your vehicles

1. Go to **Vehicles**
2. Click **"Sync from BMW"** — this loads your mapped vehicles from the CarData API automatically
3. For each vehicle, set the **MQTT Topic** to the vehicle-specific topic from Step 2 (e.g. `gcid12345abc/WBAXXXXXXX`)
4. Enter the **license plate** — required for the Tax Office export

---

### Step 6: Set up for Tax Office compliance

1. **Driver name** – set your default driver in Settings → General Settings
2. **Trip purposes** – classify each trip as Business or Private in the Trips page
3. **License plates** – must be set on each vehicle

---

## Usage Guide

### Trip Management

Trips are detected automatically when your vehicle moves more than 100m. After 10 minutes of inactivity, the trip is automatically closed.

To classify a trip:
1. Go to **Trips**
2. Click the classify dropdown on any trip
3. Select: Business or Private
4. For business trips, add the destination and contact in the trip detail view

### Export (Tax Office)

1. Go to **Export**
2. Select vehicle and year
3. Ensure all trips are classified
4. Download as CSV (for Excel/tax advisor) or open PDF view for printing

---

## German Tax Office Compliance

This app generates exports that comply with the requirements of the German Federal Ministry of Finance (BMF) for electronic driving logs.

The export includes all required fields per § 6 Abs. 1 Nr. 4 EStG:

1. Date of each trip
2. Start and end location with full address
3. Distance in km
4. Odometer readings at start and end
5. Purpose of trip with classification
6. Business destination and contact for business trips
7. Driver name
8. Vehicle data: make, model, license plate, VIN
9. Annual totals: total km, business km, private km

**Note:** The Tax Office requires continuous recording without gaps. Ensure your MQTT connection remains active while the vehicle is in use.

---

## Tax Office Requirements Checklist

Before submitting your logbook to the tax authority, verify:

- [ ] All trips are classified (no "Unclassified" trips remain)
- [ ] Business trips have a destination/purpose filled in
- [ ] All trips have a driver name
- [ ] Vehicle has a license plate set
- [ ] The year's trips are complete (no gaps)
- [ ] Export the CSV or PDF for the relevant tax year

---

## API Reference

### Authentication
- `POST /api/auth/device-code` – Start Device Code Flow
- `POST /api/auth/token` – Exchange device code for tokens
- `POST /api/auth/refresh` – Refresh tokens

### Settings
- `GET /api/settings` – Get settings (no tokens exposed)
- `PUT /api/settings` – Update settings

### Vehicles
- `GET /api/vehicles` – List vehicles
- `POST /api/vehicles` – Add vehicle
- `GET /api/vehicles/bmw-mappings` – Sync from BMW API
- `PATCH /api/vehicles/:vin` – Update vehicle
- `DELETE /api/vehicles/:vin` – Remove vehicle
- `GET /api/vehicles/:vin/live` – Live telematics

### Trips
- `GET /api/trips` – List trips (paginated, filterable)
- `POST /api/trips` – Create manual trip
- `GET /api/trips/:id` – Trip details with raw events
- `PATCH /api/trips/:id` – Update trip
- `DELETE /api/trips/:id` – Delete trip
- `GET /api/trips/export?format=csv|html` – Export

### Stats
- `GET /api/stats` – Aggregate statistics

### MQTT
- `GET /api/mqtt/status` – Connection status
- `POST /api/mqtt/reconnect` – Trigger reconnect

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser (Vue 3)                 │
│  Dashboard | Trips | Vehicles | Live | Settings  │
└─────────────────────┬───────────────────────────┘
                      │ HTTP
┌─────────────────────▼───────────────────────────┐
│            Nuxt Nitro (Server)                   │
│  ┌────────────────┐  ┌────────────────────────┐  │
│  │  REST API      │  │  MQTT Plugin           │  │
│  │  /api/...      │  │  ─ Connect to BMW      │  │
│  │                │  │  ─ Parse messages      │  │
│  │                │  │  ─ Store RawEvents     │  │
│  │                │  │  ─ Trip Detector       │  │
│  └────────────────┘  └────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐ │
│  │  MongoDB (Mongoose)                          │ │
│  │  Settings | Vehicle | RawEvent | Trip        │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────┬────────────┘
                                       │ MQTT (TLS)
                      ┌────────────────▼──────────┐
                      │  BMW CarData MQTT Broker  │
                      │  Real-time telematics     │
                      └───────────────────────────┘
```

---

## Troubleshooting

**MQTT not connecting:**
- Verify host, port, and topic pattern are correct
- Check that the ID token hasn't expired (Settings shows expiry)
- Try clicking "Reconnect" after saving settings
- The ID token is automatically refreshed 15 minutes before expiry

**No trips being recorded:**
- Check MQTT status is green (connected)
- Verify your vehicle's MQTT topic matches what you entered
- Check that the telematic keys are enabled in the BMW portal

**BMW API errors (403/401):**
- Your access token may have expired – click "Refresh token manually"
- Check your subscriptions are active in the BMW portal

**Docker issues:**
- Run `docker compose logs app` to see app errors
- Run `docker compose logs mongo` to see database errors
- Run `docker compose down && docker compose up -d` to restart

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Please follow the existing code style (TypeScript, ESLint) and add appropriate error handling.

---

## License

MIT License – see [LICENSE](LICENSE) for details.

---

## Disclaimer

This project is not affiliated with, endorsed by, or connected to BMW AG. BMW, BMW ConnectedDrive, and BMW CarData are trademarks of BMW AG. Use of the BMW CarData API requires an active subscription from BMW AG.

The user is responsible for ensuring their use of the BMW CarData API complies with BMW's terms of service.
