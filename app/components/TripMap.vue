<template>
  <div ref="mapContainer" class="w-full" :style="{ height: height }" />
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
interface Waypoint {
  lat: number
  lng: number
  timestamp?: Date | string
}

interface Props {
  waypoints?: Waypoint[]
  startLocation?: { lat: number; lng: number } | null
  endLocation?: { lat: number; lng: number } | null
  startAddress?: string
  endAddress?: string
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  waypoints: () => [],
  startLocation: null,
  endLocation: null,
  startAddress: '',
  endAddress: '',
  height: '400px',
})

const mapContainer = ref<HTMLElement | null>(null)
let map: any = null
let L: any = null

onMounted(async () => {
  if (!mapContainer.value) return

  // Wait for the container to be laid out (ClientOnly + CSS can delay sizing)
  await nextTick()

  // Dynamically import Leaflet (client-side only)
  L = (await import('leaflet')).default

  // Fix default icon paths (known Leaflet/webpack issue)
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })

  map = L.map(mapContainer.value)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)

  renderTrip()

  // Force Leaflet to recalculate container size after layout is stable
  setTimeout(() => map?.invalidateSize(), 100)
  setTimeout(() => map?.invalidateSize(), 500)
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(
  () => [props.waypoints, props.startLocation, props.endLocation],
  () => {
    if (map && L) renderTrip()
  },
  { deep: true },
)

function renderTrip() {
  if (!map || !L) return

  // Clear existing layers except tile layer
  map.eachLayer((layer: any) => {
    if (layer instanceof L.TileLayer) return
    map.removeLayer(layer)
  })

  const points: Array<[number, number]> = []

  // Add start marker
  const startCoord = props.startLocation || props.waypoints?.[0]
  if (startCoord) {
    const greenIcon = L.divIcon({
      className: '',
      html: '<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
    const marker = L.marker([startCoord.lat, startCoord.lng], { icon: greenIcon })
    if (props.startAddress) {
      marker.bindPopup(`<strong>Start</strong><br>${props.startAddress}`)
    } else {
      marker.bindPopup('<strong>Start</strong>')
    }
    marker.addTo(map)
    points.push([startCoord.lat, startCoord.lng])
  }

  // Draw waypoints as polyline
  if (props.waypoints && props.waypoints.length > 1) {
    const latLngs = props.waypoints.map(w => [w.lat, w.lng] as [number, number])
    L.polyline(latLngs, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.85,
    }).addTo(map)

    for (const wp of latLngs) {
      if (!points.find(p => p[0] === wp[0] && p[1] === wp[1])) {
        points.push(wp)
      }
    }
  } else if (props.startLocation && props.endLocation) {
    // No waypoints but start + end known — draw straight line
    L.polyline(
      [[props.startLocation.lat, props.startLocation.lng], [props.endLocation.lat, props.endLocation.lng]],
      { color: '#3b82f6', weight: 4, opacity: 0.6, dashArray: '8 6' },
    ).addTo(map)
  }

  // Add end marker
  const endCoord = props.endLocation || (props.waypoints?.length > 1 ? props.waypoints[props.waypoints.length - 1] : null)
  if (endCoord) {
    const redIcon = L.divIcon({
      className: '',
      html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
    const marker = L.marker([endCoord.lat, endCoord.lng], { icon: redIcon })
    if (props.endAddress) {
      marker.bindPopup(`<strong>Ziel</strong><br>${props.endAddress}`)
    } else {
      marker.bindPopup('<strong>End</strong>')
    }
    marker.addTo(map)
    if (!points.find(p => p[0] === endCoord.lat && p[1] === endCoord.lng)) {
      points.push([endCoord.lat, endCoord.lng])
    }
  }

  // Fit map to bounds
  if (points.length === 1) {
    map.setView(points[0], 14)
  } else if (points.length > 1) {
    map.fitBounds(points, { padding: [30, 30] })
  } else {
    // Default to Germany center
    map.setView([51.1657, 10.4515], 6)
  }
}
</script>
