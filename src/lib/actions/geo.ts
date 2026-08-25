"use server";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";

export interface GeocodeHit {
  lat: number;
  lng: number;
  label: string;
}

// Shared Nominatim (OpenStreetMap) lookup — done on the server so we can send
// a proper User-Agent and avoid browser CORS limits. Coordinates are biased
// to India and returned at full precision — the same point you'd read off
// Google Maps.
async function nominatimSearch(query: string, userAgent: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      format: "jsonv2",
      q,
      limit: "5",
      countrycodes: "in",
      addressdetails: "0",
    }).toString();

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    return rows.map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lon),
      label: r.display_name,
    }));
  } catch {
    return [];
  }
}

// Admin place-management search — used when curating tourist places.
export async function geocodePlace(query: string): Promise<GeocodeHit[]> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return [];
  return nominatimSearch(query, "YatraPoint-Admin/1.0 (admin place geocoding)");
}

// Consumer-facing search — lets a signed-in user correct their own detected
// location (e.g. a desktop browser's coarse IP-based fix) by searching for
// their address or area. Any logged-in user may call this; it's just a
// lookup, not a write.
export async function searchLocation(query: string): Promise<GeocodeHit[]> {
  const session = await auth();
  if (!session?.user) return [];
  return nominatimSearch(query, "YatraPoint/1.0 (user location search)");
}
