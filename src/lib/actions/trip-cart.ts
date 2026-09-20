"use server";

import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { isVisiblePlace } from "@/lib/place-visibility";
import { PLACE_KINDS, kindsOf } from "@/lib/queries/places";

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

  // Both cart prefixes resolve against the same table now — the id after the
  // prefix is a `places` id either way, so this is one lookup instead of two.
  const catalogueIds = items
    .filter((i) => i.id.startsWith("dest-") || i.id.startsWith("nearby-"))
    .map((i) => (i.id.startsWith("dest-") ? i.id.slice(5) : i.id.slice(7)));

  const rows = catalogueIds.length
    ? await db.select().from(places).where(inArray(places.id, catalogueIds))
    : [];
  const byId = new Map(rows.map((p) => [p.id, p]));

  for (const item of items) {
    const isCatalogue = item.id.startsWith("dest-") || item.id.startsWith("nearby-");
    if (isCatalogue) {
      const key = item.id.startsWith("dest-") ? item.id.slice(5) : item.id.slice(7);
      const p = byId.get(key);

      if (p) {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const kinds = kindsOf(p);
          const isDayTrip = kinds.includes(PLACE_KINDS.dayTrip);
          out.push({
            id: item.id,
            name: p.name,
            // The place's OWN context, not the city you'd set out from.
            label:
              isDayTrip && p.distanceKm != null && p.baseCity
                ? `${p.distanceKm} km from ${p.baseCity}`
                : [p.district, p.state].filter(Boolean).join(", ") || p.name,
            lat,
            lng,
            entryFee: p.entryFeePerPerson,
            // A multi-day destination states its own per-day budget. A day trip
            // is exactly one day with no overnight stay, so its spend beyond
            // the ticket is food and local travel — counted rather than
            // silently skipped, which used to leave it out of the estimate.
            budgetPerDay: p.budgetPerDay ?? (isDayTrip ? DAY_TRIP_BUDGET_PER_PERSON : undefined),
            recommendedDays: p.recommendedDays ?? (isDayTrip ? 1 : undefined),
            closed: !isVisiblePlace(p),
          });
          continue;
        }
      }

      // No row, or no usable coordinates — fall back to geocoding whatever
      // location context we have.
      const q = p
        ? [p.district, p.state, "India"].filter(Boolean).join(", ")
        : item.subtitle || item.name;
      const g = await geocode(q);
      out.push(
        g
          ? { id: item.id, name: p?.name ?? item.name, label: q, lat: g.lat, lng: g.lng }
          : {
              id: item.id,
              name: p?.name ?? item.name,
              label: q,
              lat: 0,
              lng: 0,
              unlocated: true,
            }
      );
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
