import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const markerIcon = new L.Icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] })

export default function EmergencyMap({ emergencies }) {
  const center = emergencies.length ? [emergencies[0].latitude, emergencies[0].longitude] : [20.5937, 78.9629]
  return <MapContainer className="map" center={center} zoom={emergencies.length ? 13 : 5} scrollWheelZoom><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{emergencies.map((emergency) => <Marker key={emergency.id} position={[emergency.latitude, emergency.longitude]} icon={markerIcon}><Popup><strong>{emergency.emergency_type}</strong><br />Alert #{emergency.id}</Popup></Marker>)}</MapContainer>
}