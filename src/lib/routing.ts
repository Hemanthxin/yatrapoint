import type { LatLng } from "./geo";

// OSRM driving route response we actually use.
export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry: [number, number][]; // array of [lat, lng] for Leaflet polyline
}

// Pin to a single OSRM by setting NEXT_PUBLIC_OSRM_URL (e.g. a self-hosted
// instance), otherwise try the official demo first then a community mirror.
const OSRM_BASES: string[] = (() => {
  const override = process.env.NEXT_PUBLIC_OSRM_URL;
  if (override) return [override];
  return ["https://router.project-osrm.org", "https://routing.openstreetmap.de/routed-car"];
})();

const OSRM_UA = "YatraPoint/1.0 (https://yatrapoint.local; contact: dev@yatrapoint.local)";

async function tryEachBase(
  pathAfterBase: string,
  signal?: AbortSignal
): Promise<Response | null> {
  for (const base of OSRM_BASES) {
    try {
      const res = await fetch(`${base}${pathAfterBase}`, {
        signal,
        headers: { "User-Agent": OSRM_UA, Accept: "application/json" },
      });
      if (res.ok) return res;
      // 4xx/5xx — try next mirror.
    } catch {
      // Network error — try next mirror.
    }
  }
  return null;
}

// Fetch a driving route between two points. Returns null on failure so the
// caller can fall back to haversine + seeded driving minutes.
export async function fetchDrivingRoute(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal
): Promise<RouteResult | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const path = `/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await tryEachBase(path, signal);
  if (!res) return null;
  try {
    const data: OsrmResponse = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      // OSRM emits [lng, lat]; Leaflet wants [lat, lng].
      geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
  } catch {
    return null;
  }
}

interface OsrmResponse {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }>;
}

// A driving route through waypoints IN THE GIVEN ORDER (no reordering), with a
// per-leg breakdown. Use this when you want to preserve a nearest-first visit
// order but still need real road distances + geometry.
export interface RouteWithLegs {
  distanceKm: number;
  durationMinutes: number;
  geometry: [number, number][]; // [lat, lng] for Leaflet
  legs: Array<{ distanceKm: number; durationMinutes: number }>;
}

interface OsrmRouteResponse {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs?: Array<{ distance: number; duration: number }>;
  }>;
}

export async function fetchRoute(
  waypoints: LatLng[],
  signal?: AbortSignal
): Promise<RouteWithLegs | null> {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const path = `/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await tryEachBase(path, signal);
  if (!res) return null;
  try {
    const data: OsrmRouteResponse = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: (route.legs ?? []).map((l) => ({
        distanceKm: l.distance / 1000,
        durationMinutes: l.duration / 60,
      })),
    };
  } catch {
    return null;
  }
}

// Multi-stop optimised route. Uses OSRM's /trip endpoint, which solves the
// Travelling-Salesman Problem (greedy + 2-opt) and returns the best order.
export interface TripResult {
  distanceKm: number;
  durationMinutes: number;
  geometry: [number, number][]; // [lat, lng] for Leaflet
  // The order in which OSRM visited the input waypoints. waypointOrder[k] is
  // the original input index of the k-th visited stop.
  waypointOrder: number[];
  // Per-leg breakdown (between consecutive visited waypoints).
  legs: Array<{ distanceKm: number; durationMinutes: number }>;
}

interface OsrmTripResponse {
  trips?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs: Array<{ distance: number; duration: number }>;
  }>;
  waypoints?: Array<{
    waypoint_index: number;
    trips_index: number;
    location: [number, number];
  }>;
}

export interface FetchTripOptions {
  // Two or more waypoints in input order. First is treated as start; if
  // `roundtrip` is true the trip returns to it.
  waypoints: LatLng[];
  roundtrip?: boolean;
  fixedFirst?: boolean; // pin the first waypoint as the start
  fixedLast?: boolean; // pin the last waypoint as the end
  signal?: AbortSignal;
}

export async function fetchTrip(
  opts: FetchTripOptions
): Promise<TripResult | null> {
  if (opts.waypoints.length < 2) return null;

  const coords = opts.waypoints
    .map((p) => `${p.lng},${p.lat}`)
    .join(";");
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    roundtrip: String(opts.roundtrip ?? false),
    source: opts.fixedFirst ?? true ? "first" : "any",
    destination: opts.fixedLast ? "last" : "any",
  });

  const path = `/trip/v1/driving/${coords}?${params.toString()}`;

  const res = await tryEachBase(path, opts.signal);
  if (!res) return null;
  try {
    const data: OsrmTripResponse = await res.json();
    const trip = data.trips?.[0];
    if (!trip || !data.waypoints) return null;

    // Build the visited order: waypoints array is in INPUT order, with each
    // entry's `waypoint_index` telling us its position in the optimised trip.
    const order = data.waypoints
      .map((w, inputIdx) => ({ inputIdx, visitIdx: w.waypoint_index }))
      .sort((a, b) => a.visitIdx - b.visitIdx)
      .map((x) => x.inputIdx);

    return {
      distanceKm: trip.distance / 1000,
      durationMinutes: trip.duration / 60,
      geometry: trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      waypointOrder: order,
      legs: trip.legs.map((l) => ({
        distanceKm: l.distance / 1000,
        durationMinutes: l.duration / 60,
      })),
    };
  } catch {
    return null;
  }
}
