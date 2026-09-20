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

// Turns detected coordinates into a short, human-readable place name (e.g.
// "HSR Layout, Karnataka") for display next to "Using your live location" —
// raw lat/lng numbers don't tell a traveller where they actually are.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url =
    "https://nominatim.openstreetmap.org/reverse?" +
    new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      zoom: "12",
      addressdetails: "1",
    }).toString();

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "YatraPoint/1.0 (reverse geocoding)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };
    const a = data.address;
    if (!a) return data.display_name ?? null;
    const locality =
      a.suburb || a.neighbourhood || a.city_district || a.town || a.village || a.city || a.county;
    return [locality, a.state].filter(Boolean).join(", ") || data.display_name || null;
  } catch {
    return null;
  }
}
