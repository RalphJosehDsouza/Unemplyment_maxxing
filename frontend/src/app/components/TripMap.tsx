import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Truck SVG icon ──────────────────────────────────────────────────────────
const truckSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5" fill="#3b82f6" stroke="#3b82f6"/><circle cx="18.5" cy="18.5" r="2.5" fill="#3b82f6" stroke="#3b82f6"/></svg>`;

const truckIcon = L.divIcon({
  html: truckSvg,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const pinIcon = (color: string) =>
  L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="${color}" stroke="#fff" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 20],
  });

const CITY_COORDS: Record<string, [number, number]> = {
  'Mumbai': [19.0760, 72.8777],
  'Pune': [18.5204, 73.8567],
  'Nashik': [20.0110, 73.7905],
  'Nagpur': [21.1458, 79.0882],
  'Aurangabad': [19.8762, 75.3433],
  'Gandhinagar': [23.2156, 72.6369],
  'Delhi': [28.7041, 77.1025],
  'Bangalore': [12.9716, 77.5946],
  'Chennai': [13.0827, 80.2707],
  'Kolkata': [22.5726, 88.3639],
  'Ahmedabad': [23.0225, 72.5714],
  'Hyderabad': [17.3850, 78.4867],
  'Thane': [19.2183, 72.9781],
  'Surat': [21.1702, 72.8311]
};

async function geocode(place: string): Promise<[number, number] | null> {
  if (!place) return [19.7515, 75.7139];
  const normalized = place.trim().toLowerCase();
  if (!normalized) return [19.7515, 75.7139];
  
  // 1. Check local dictionary first
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(city.toLowerCase())) return coords;
  }

  // 2. To completely avoid 429/CORS errors during the demo, we NEVER call 
  // Nominatim for unknown cities. Instead, we generate a stable, pseudo-random 
  // coordinate near Maharashtra based on the string length.
  const offsetLat = (normalized.length % 10) * 0.1;
  const offsetLon = (normalized.charCodeAt(0) % 10) * 0.1;
  
  const lat = 19.7515 + (isNaN(offsetLat) ? 0 : offsetLat);
  const lon = 75.7139 + (isNaN(offsetLon) ? 0 : offsetLon);
  return [lat, lon];
}

// ── Route via OSRM demo server ──────────────────────────────────────────────
async function getRoute(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (data.routes?.[0]) {
      return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
    }
  } catch { /* ignore */ }
  // Fallback: straight line
  return [from, to];
}

// ── Auto-fit map bounds ─────────────────────────────────────────────────────
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }, [map, points]);
  return null;
}

// ── Main component ──────────────────────────────────────────────────────────
interface TripMapProps {
  source: string;
  destination: string;
  status: string;
}

interface RouteData {
  from: [number, number];
  to: [number, number];
  route: [number, number][];
}

export default function TripMap({ source, destination, status }: TripMapProps) {
  const [data, setData] = useState<RouteData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [animIdx, setAnimIdx] = useState(0);
  const cacheKey = useRef('');

  useEffect(() => {
    const key = `${source}|${destination}`;
    if (key === cacheKey.current) return;
    cacheKey.current = key;

    setLoading(true);
    setError(false);

    (async () => {
      const [from, to] = await Promise.all([geocode(source), geocode(destination)]);
      if (!from || !to) { setError(true); setLoading(false); return; }
      const route = await getRoute(from, to);
      setData({ from, to, route });
      setLoading(false);
      setAnimIdx(0);
    })();
  }, [source, destination]);

  useEffect(() => {
    if (status !== 'DISPATCHED' || !data || data.route.length === 0) return;
    const interval = setInterval(() => {
      setAnimIdx((prev) => (prev + 1) % data.route.length);
    }, 100);
    return () => clearInterval(interval);
  }, [status, data]);

  if (loading) {
    return (
      <div style={{ height: 180, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
          LOADING MAP…
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ height: 80, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
          MAP UNAVAILABLE — Could not geocode locations
        </span>
      </div>
    );
  }

  const routeColor = status === 'DISPATCHED' ? '#3b82f6'
    : status === 'COMPLETED' ? '#10b981'
    : status === 'CANCELLED' ? '#ef4444'
    : '#f59e0b';

  // Position truck
  const truckPos = status === 'DISPATCHED' && data.route.length > 0
    ? data.route[animIdx]
    : (data.route[Math.floor(data.route.length / 2)] || data.from);

  return (
    <div style={{ height: 240, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 8 }}>
      <MapContainer
        center={data.from}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={true}
        dragging={true}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <FitBounds points={[data.from, data.to]} />
        <Polyline
          positions={data.route}
          pathOptions={{ color: routeColor, weight: 3, opacity: 0.85, dashArray: status === 'DRAFT' ? '8 6' : undefined }}
        />
        <Marker position={data.from} icon={pinIcon('#10b981')} />
        <Marker position={data.to} icon={pinIcon('#ef4444')} />
        <Marker position={truckPos} icon={truckIcon} />
      </MapContainer>
    </div>
  );
}
