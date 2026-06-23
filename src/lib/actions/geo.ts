"use server";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";

export interface GeocodeHit {
  lat: number;
  lng: number;
  label: string;
}

// Server-side geocoding via OpenStreetMap Nominatim (free, no key). Done on the
// server so we can send a proper User-Agent and avoid browser CORS limits.
// Coordinates are biased to India and returned at full precision — the same
// point you'd read off Google Maps.
export async function geocodePlace(query: string): Promise<GeocodeHit[]> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return [];

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
      headers: {
        "User-Agent": "YatraPoint-Admin/1.0 (admin place geocoding)",
        Accept: "application/json",
      },
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
