"use server";

import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { destinations } from "@/lib/db/schema";

export interface TripStop {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  // Budget fields — present for catalogue destinations (used to estimate the
  // trip cost). Festivals / geocoded-only stops leave these undefined.
  entryFee?: number;
  budgetPerDay?: number;
  recommendedDays?: number;
}

// Geocode a free-text place via Nominatim (India-scoped, cached at the data layer).
async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  if (!q.trim()) return null;
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({ format: "jsonv2", q, limit: "1", countrycodes: "in" }).toString();
    const res = await fetch(url, {
      headers: { "User-Agent": "Saafera/1.0 (trip cart)", Accept: "application/json" },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    const r = rows[0];
    if (!r) return null;
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

// Turn the trip-cart items into map stops with real coordinates. Destinations
// resolve from the DB (or geocode their district/state); festivals & anything
// else geocode from their primary hub city.
export async function resolveTripStops(
  items: { id: string; name: string; subtitle?: string; kind?: string }[]
): Promise<TripStop[]> {
  const out: TripStop[] = [];

  const destIds = items.filter((i) => i.id.startsWith("dest-")).map((i) => i.id.slice(5));
  const destRows = destIds.length
    ? await db.select().from(destinations).where(inArray(destinations.id, destIds))
    : [];
  const destMap = new Map(destRows.map((d) => [d.id, d]));

  for (const item of items) {
    if (item.id.startsWith("dest-")) {
      const d = destMap.get(item.id.slice(5));
      if (d?.latitude && d?.longitude) {
        out.push({
          id: item.id,
          name: item.name,
          label: [d.district, d.state].filter(Boolean).join(", ") || item.name,
          lat: Number(d.latitude),
          lng: Number(d.longitude),
          entryFee: d.entryFees,
          budgetPerDay: d.budgetPerDay,
          recommendedDays: d.recommendedDays,
        });
        continue;
      }
      const q = d ? [d.district, d.state, "India"].filter(Boolean).join(", ") : item.name;
      const g = await geocode(q);
      if (g) out.push({ id: item.id, name: item.name, label: q, lat: g.lat, lng: g.lng });
      continue;
    }

    // Festival / other — geocode the primary hub city (first before "·"/","/"/").
    const hub = (item.subtitle ?? "").split("·")[0].trim();
    const firstCity = (hub.split(/[,/]/)[0] || "").trim() || item.name;
    const g = await geocode(`${firstCity}, India`);
    if (g) out.push({ id: item.id, name: item.name, label: hub || firstCity, lat: g.lat, lng: g.lng });
  }

  return out;
}
