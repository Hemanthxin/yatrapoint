"use server";

import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { destinations, nearbyDestinations } from "@/lib/db/schema";
import { isVisiblePlace } from "@/lib/place-visibility";

// Mid-range per-person, per-day allowance for a day trip: local travel, meals
// and incidentals. Same scale as `destinations.budgetPerDay`, which is the
// equivalent figure for multi-day places.
const DAY_TRIP_BUDGET_PER_PERSON = 700;

export interface TripStop {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  // Budget fields — present for catalogue places (used to estimate the trip
  // cost). Festivals / geocoded-only stops leave these undefined.
  entryFee?: number;
  budgetPerDay?: number;
  recommendedDays?: number;
  // True when we could not pin the stop to real coordinates. Such a stop is
  // still listed (so the traveller can see and remove it) but is left off the
  // map and out of the cost estimate.
  unlocated?: boolean;
  // Set when the place is permanently closed, so the cart can say so instead
  // of quietly costing a trip to somewhere that no longer exists (BUG-01).
  closed?: boolean;
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

// Turn the trip-cart items into map stops with real coordinates.
//
// BUG-14: only `dest-` items were ever looked up. A one-day trip added from
// /one-day-trips carries a `nearby-` id, so it fell through to the festival
// branch and was geocoded from its SUBTITLE — which for those cards is the base
// city. Adding "Nandi Hills" therefore pinned the stop on Bangalore and
// labelled it "Bangalore": the wrong location and the wrong context on the
// trip-cost screen, with no budget data so the cost was wrong too. Both
// catalogue tables are now resolved from their own real rows.
export async function resolveTripStops(
  items: { id: string; name: string; subtitle?: string; kind?: string }[]
): Promise<TripStop[]> {
  const out: TripStop[] = [];

  const destIds = items.filter((i) => i.id.startsWith("dest-")).map((i) => i.id.slice(5));
  const nearbyIds = items.filter((i) => i.id.startsWith("nearby-")).map((i) => i.id.slice(7));

  const [destRows, nearbyRows] = await Promise.all([
    destIds.length
      ? db.select().from(destinations).where(inArray(destinations.id, destIds))
      : Promise.resolve([]),
    nearbyIds.length
      ? db.select().from(nearbyDestinations).where(inArray(nearbyDestinations.id, nearbyIds))
      : Promise.resolve([]),
  ]);
  const destMap = new Map(destRows.map((d) => [d.id, d]));
  const nearbyMap = new Map(nearbyRows.map((n) => [n.id, n]));

  for (const item of items) {
    if (item.id.startsWith("dest-")) {
      const d = destMap.get(item.id.slice(5));
      if (d?.latitude && d?.longitude) {
        out.push({
          id: item.id,
          name: d.name,
          label: [d.district, d.state].filter(Boolean).join(", ") || d.name,
          lat: Number(d.latitude),
          lng: Number(d.longitude),
          entryFee: d.entryFees,
          budgetPerDay: d.budgetPerDay,
          recommendedDays: d.recommendedDays,
          closed: !isVisiblePlace(d),
        });
        continue;
      }
      const q = d ? [d.district, d.state, "India"].filter(Boolean).join(", ") : item.name;
      const g = await geocode(q);
      out.push(
        g
          ? { id: item.id, name: item.name, label: q, lat: g.lat, lng: g.lng }
          : { id: item.id, name: item.name, label: q, lat: 0, lng: 0, unlocated: true }
      );
      continue;
    }

    // One-day trips carry their own precise coordinates, entry fee and time at
    // the place — use them rather than geocoding the base city.
    if (item.id.startsWith("nearby-")) {
      const n = nearbyMap.get(item.id.slice(7));
      if (n) {
        const lat = Number(n.latitude);
        const lng = Number(n.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          out.push({
            id: item.id,
            name: n.name,
            // The place's OWN context, not the city you'd set out from.
            label: `${n.distanceKm} km from ${n.baseCity}`,
            lat,
            lng,
            entryFee: n.entryFeePerPerson,
            // A day trip is exactly that — one day, and no overnight stay. Its
            // spend beyond the entry ticket is food and local travel, so it
            // counts toward the estimate instead of being silently skipped.
            budgetPerDay: DAY_TRIP_BUDGET_PER_PERSON,
            recommendedDays: 1,
            closed: !isVisiblePlace(n),
          });
          continue;
        }
      }
      out.push({
        id: item.id,
        name: item.name,
        label: item.subtitle ?? "Location unavailable",
        lat: 0,
        lng: 0,
        unlocated: true,
      });
      continue;
    }

    // Festival / other — geocode the primary hub city (first before "·"/","/"/").
    const hub = (item.subtitle ?? "").split("·")[0].trim();
    const firstCity = (hub.split(/[,/]/)[0] || "").trim() || item.name;
    const g = await geocode(`${firstCity}, India`);
    out.push(
      g
        ? { id: item.id, name: item.name, label: hub || firstCity, lat: g.lat, lng: g.lng }
        : {
            // Previously an un-geocodable stop was dropped from the list
            // entirely, so a place the traveller had added simply vanished from
            // the trip-cost screen with no explanation (BUG-14). Keep it
            // visible and removable, just off the map.
            id: item.id,
            name: item.name,
            label: hub || firstCity,
            lat: 0,
            lng: 0,
            unlocated: true,
          }
    );
  }

  return out;
}
