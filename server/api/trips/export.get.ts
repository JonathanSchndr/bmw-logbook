import { connectDB } from '../../utils/db'
import { TripModel } from '../../models/Trip'
import { VehicleModel } from '../../models/Vehicle'

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function purposeLabel(p: string): string {
  const map: Record<string, string> = {
    business: 'Business',
    private: 'Private',
    unclassified: 'Unclassified',
  }
  return map[p] || p
}

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const query = getQuery(event) as {
      vin?: string
      year?: string
      format?: string
      purpose?: string
    }

    const format = query.format || 'csv'
    const filter: Record<string, any> = {}

    if (query.vin) filter.vin = query.vin.toUpperCase()
    if (query.purpose) filter.purpose = query.purpose

    let year: number | null = null
    if (query.year) {
      year = parseInt(query.year)
      filter.startTime = {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1),
      }
    }

    const trips = await TripModel.find(filter).sort({ startTime: 1 }).lean()

    // Get vehicle info
    const vin = query.vin?.toUpperCase()
    const vehicle = vin ? await VehicleModel.findOne({ vin }).lean() : null

    // Calculate totals
    const totalKm = trips.reduce((sum, t) => sum + (t.distanceKm || 0), 0)
    const businessKm = trips.filter(t => t.purpose === 'business').reduce((sum, t) => sum + (t.distanceKm || 0), 0)
    const privateKm = trips.filter(t => t.purpose === 'private').reduce((sum, t) => sum + (t.distanceKm || 0), 0)

    if (format === 'csv') {
      const headers = [
        'Date',
        'Departure time',
        'Arrival time',
        'Vehicle (license plate)',
        'Vehicle (make/model)',
        'VIN',
        'Departure address',
        'Destination address',
        'Distance (km)',
        'Odometer start (km)',
        'Odometer end (km)',
        'Trip purpose',
        'Business destination / reason',
        'Business contact / partner',
        'Driver',
        'Notes',
      ]

      const rows = trips.map((t) => [
        formatDate(new Date(t.startTime)),
        new Date(t.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        t.endTime ? new Date(t.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        vehicle?.licensePlate || vin || '',
        vehicle ? `${vehicle.make} ${vehicle.model}` : '',
        t.vin,
        t.startAddress || '',
        t.endAddress || '',
        (t.distanceKm || 0).toFixed(1),
        t.startOdometer !== null ? t.startOdometer.toString() : '',
        t.endOdometer !== null ? t.endOdometer.toString() : '',
        purposeLabel(t.purpose),
        t.businessDestination || '',
        t.businessContact || '',
        t.driver || '',
        t.notes || '',
      ])

      // Add totals row
      rows.push([])
      rows.push(['TOTAL', '', '', '', '', '', '', '', totalKm.toFixed(1), '', '', '', '', '', '', ''])
      rows.push(['Business (km)', '', '', '', '', '', '', '', businessKm.toFixed(1), '', '', '', '', '', '', ''])
      rows.push(['Private (km)', '', '', '', '', '', '', '', privateKm.toFixed(1), '', '', '', '', '', '', ''])

      const csvContent = [
        headers.join(';'),
        ...rows.map(row =>
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'),
        ),
      ].join('\r\n')

      const filename = `logbook_${vin || 'all'}_${year || 'all'}.csv`

      setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
      setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

      // BOM for Excel
      return '\uFEFF' + csvContent
    }

    if (format === 'html') {
      const vehicleInfo = vehicle
        ? `${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''} | License plate: ${vehicle.licensePlate || 'unknown'} | VIN: ${vehicle.vin}`
        : `VIN: ${vin || 'all vehicles'}`

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logbook ${year || ''} - ${vehicle?.licensePlate || vin || ''}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10pt; margin: 20mm; color: #000; }
    h1 { font-size: 18pt; margin-bottom: 5mm; }
    h2 { font-size: 14pt; margin-top: 10mm; }
    .vehicle-info { background: #f5f5f5; padding: 10px; margin-bottom: 10mm; border: 1px solid #ccc; }
    .vehicle-info p { margin: 3px 0; }
    .totals { background: #e8f4f8; padding: 10px; margin-bottom: 10mm; border: 1px solid #b0d4e8; }
    .totals table { width: 100%; }
    table { width: 100%; border-collapse: collapse; margin-top: 5mm; font-size: 9pt; }
    th { background: #2563eb; color: white; padding: 4px 6px; text-align: left; font-size: 8pt; }
    td { padding: 3px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) { background: #f9f9f9; }
    .business { color: #1d4ed8; font-weight: bold; }
    .private { color: #7c3aed; }
    .unclassified { color: #dc2626; }
    .total-row { font-weight: bold; background: #e5e7eb !important; }
    @media print {
      body { margin: 10mm; }
      .page-break { page-break-before: always; }
      @page { margin: 10mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <h1>Logbook</h1>
  <div class="vehicle-info">
    <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
    <p><strong>Period:</strong> ${year ? `01/01/${year} – 12/31/${year}` : 'All time'}</p>
    <p><strong>Generated:</strong> ${formatDateTime(new Date())}</p>
    <p><strong>Total trips:</strong> ${trips.length}</p>
  </div>

  <div class="totals">
    <h2>Annual summary</h2>
    <table>
      <tr><td><strong>Total distance:</strong></td><td>${totalKm.toFixed(1)} km</td></tr>
      <tr><td><strong>Business trips:</strong></td><td>${businessKm.toFixed(1)} km</td></tr>
      <tr><td><strong>Private trips:</strong></td><td>${privateKm.toFixed(1)} km</td></tr>
      <tr><td><strong>Unclassified:</strong></td><td>${(totalKm - businessKm - privateKm).toFixed(1)} km</td></tr>
    </table>
  </div>

  <h2>Trip details</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>Departure</th>
        <th>Arrival</th>
        <th>From</th>
        <th>To</th>
        <th>km</th>
        <th>Odo. start</th>
        <th>Odo. end</th>
        <th>Purpose</th>
        <th>Business dest. / contact</th>
        <th>Driver</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${trips.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${formatDate(new Date(t.startTime))}</td>
        <td>${new Date(t.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
        <td>${t.endTime ? new Date(t.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '–'}</td>
        <td>${t.startAddress || '–'}</td>
        <td>${t.endAddress || '–'}</td>
        <td>${(t.distanceKm || 0).toFixed(1)}</td>
        <td>${t.startOdometer !== null ? t.startOdometer : '–'}</td>
        <td>${t.endOdometer !== null ? t.endOdometer : '–'}</td>
        <td class="${t.purpose}">${purposeLabel(t.purpose)}</td>
        <td>${[t.businessDestination, t.businessContact].filter(Boolean).join(' / ') || '–'}</td>
        <td>${t.driver || '–'}</td>
        <td>${t.notes || ''}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="6"><strong>TOTAL</strong></td>
        <td><strong>${totalKm.toFixed(1)}</strong></td>
        <td colspan="6"></td>
      </tr>
    </tbody>
  </table>

  <script>
    window.onload = function() {
      // Auto-print if ?print=1
      if (new URLSearchParams(window.location.search).get('print') === '1') {
        window.print();
      }
    };
  </script>
</body>
</html>`

      setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
      return html
    }

    throw createError({ statusCode: 400, message: 'Invalid format. Use csv or html' })
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})
