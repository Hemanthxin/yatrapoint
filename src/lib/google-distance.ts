// Real driving distance via Google's Distance Matrix API — server-only (the
// API key must never reach the client). One origin (the traveller's live
// location) against up to 25 destinations per call, matching the API's own
// per-request element cap. Returns null per-destination on any failure so
// callers can fall back to the straight-line (haversine) estimate instead of
// breaking the page.
import type { LatLng } from "./geo";

const MAX_DESTINATIONS = 25;

export async function fetchDrivingDistancesKm(
  origin: LatLng,
  destinations: LatLng[]
): Promise<(number | null)[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || destinations.length === 0) return destinations.map(() => null);

  const points = destinations.slice(0, MAX_DESTINATIONS);
  const url =
    "https://maps.googleapis.com/maps/api/distancematrix/json?" +
    new URLSearchParams({
      units: "metric",
      mode: "driving",
      origins: `${origin.lat},${origin.lng}`,
      destinations: points.map((p) => `${p.lat},${p.lng}`).join("|"),
      key,
    }).toString();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return destinations.map(() => null);
    const data = (await res.json()) as {
      status?: string;
      rows?: { elements?: { status?: string; distance?: { value: number } }[] }[];
    };
    if (data.status !== "OK") return destinations.map(() => null);
    const elements = data.rows?.[0]?.elements ?? [];
    const out = points.map((_, i) => {
      const el = elements[i];
      if (!el || el.status !== "OK" || !el.distance) return null;
      return el.distance.value / 1000; // metres -> km
    });
    // Anything past the 25-destination cap gets no real distance.
    while (out.length < destinations.length) out.push(null);
    return out;
  } catch {
    return destinations.map(() => null);
  }
}
