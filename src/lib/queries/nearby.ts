import { and, desc, eq, like, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { places, type NearbyDestination } from "@/lib/db/schema";
import {
  PLACE_KINDS,
  hasKind,
  notPermanentlyClosed,
  slugMatches,
  toNearbyDestination,
} from "@/lib/queries/places";

// One-day trips, read from the unified `places` table (rows whose `kinds`
// include "day-trip") and returned in the original NearbyDestination shape.

export interface NearbyFilters {
  baseCity?: string;
  category?: string;
  // Maximum driving distance (km) FROM THE BASE CITY — the meaning of the
  // 30/60/100/150 km chips on the one-day-trips page.
  maxDistanceKm?: number;
  limit?: number;
}

const isDayTrip = hasKind(PLACE_KINDS.dayTrip);

export async function listNearby(
  filters: NearbyFilters = {}
): Promise<NearbyDestination[]> {
  const where = [isDayTrip, notPermanentlyClosed];
  if (filters.baseCity) where.push(eq(places.baseCity, filters.baseCity));
  if (filters.category) where.push(eq(places.category, filters.category));
  // This filter was declared but never applied, so every server-side caller
  // asking for "trips within N km" silently got the whole catalogue (BUG-15).
  if (filters.maxDistanceKm && filters.maxDistanceKm > 0) {
    where.push(lte(places.distanceKm, filters.maxDistanceKm));
  }

  const query = db
    .select()
    .from(places)
    .where(and(...where))
    .orderBy(desc(places.popularity));

  const rows = await (filters.limit ? query.limit(filters.limit) : query);
  return rows.map(toNearbyDestination);
}

export async function getNearbyBySlug(slug: string) {
  // Matches the place's current slug or any it was merged out of, so day-trip
  // links minted before the catalogues were consolidated still resolve.
  const [row] = await db
    .select()
    .from(places)
    .where(and(isDayTrip, slugMatches(slug)))
    .limit(1);
  return row ? toNearbyDestination(row) : null;
}

// Text search over one-day-trip spots — used by the global search so results
// aren't limited to the main catalogue.
export async function searchNearby(query: string, limit = 12): Promise<NearbyDestination[]> {
  const q = `%${query.toLowerCase()}%`;
  const rows = await db
    .select()
    .from(places)
    .where(
      and(
        isDayTrip,
        notPermanentlyClosed,
        or(
          like(sql`lower(${places.name})`, q),
          like(sql`lower(${places.baseCity})`, q),
          like(sql`lower(${places.shortDescription})`, q)
        )
      )
    )
    .orderBy(desc(places.popularity))
    .limit(limit);
  return rows.map(toNearbyDestination);
}
