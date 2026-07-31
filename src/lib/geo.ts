// Geographic helpers — kept pure (no React, no DOM) so they run on the server
// for sorting + on the client for live distance updates.

export interface LatLng {
  lat: number;
  lng: number;
}

// Bangalore city centre — used as a fallback when geolocation is denied.
export const BANGALORE_CENTER: LatLng = { lat: 12.9716, lng: 77.5946 };

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Haversine great-circle distance, in km. Accurate to ~0.5% over short hops.
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Great-circle destination point: given a start, a compass bearing (0 = north,
// 90 = east, clockwise) and a distance, returns the point you'd land on. Used
// to aim a search at a point FAR from the traveller (e.g. Overpass discovery
// for a "100-200 km east" band, centred 150 km east — not at the traveller's
// own location, which a >100 km min-distance filter would reject anyway).
export function destinationPoint(from: LatLng, bearingDeg: number, distanceKm: number): LatLng {
  const angDist = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(from.lat);
  const lng1 = toRad(from.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
    );
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (((lng2 * 180) / Math.PI + 540) % 360) - 180, // normalise to -180..180
  };
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function formatMinutes(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}

// Add minutes to a Date and return HH:MM in 24h local time.
export function addMinutes(start: Date, mins: number): Date {
  return new Date(start.getTime() + mins * 60_000);
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
