import { and, desc, eq, isNull, like, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { nearbyDestinations, type NearbyDestination } from "@/lib/db/schema";

export interface NearbyFilters {
  baseCity?: string;
  category?: string;
  // Maximum driving distance (km) FROM THE BASE CITY — the meaning of the
  // 30/60/100/150 km chips on the one-day-trips page.
  maxDistanceKm?: number;
  limit?: number;
}

// Permanently-closed day trips never reach a traveller-facing list; unsynced
// rows (null) count as open. Mirrors src/lib/place-visibility.ts, in SQL.
const notPermanentlyClosed = or(
  isNull(nearbyDestinations.googleBusinessStatus),
  ne(nearbyDestinations.googleBusinessStatus, "CLOSED_PERMANENTLY")
)!;

export async function listNearby(
  filters: NearbyFilters = {}
): Promise<NearbyDestination[]> {
  const where = [notPermanentlyClosed];
  if (filters.baseCity) where.push(eq(nearbyDestinations.baseCity, filters.baseCity));
  if (filters.category) where.push(eq(nearbyDestinations.category, filters.category));
  // This filter was declared but never applied, so every server-side caller
  // asking for "trips within N km" silently got the whole catalogue (BUG-15).
  if (filters.maxDistanceKm && filters.maxDistanceKm > 0) {
    where.push(lte(nearbyDestinations.distanceKm, filters.maxDistanceKm));
  }

  const query = db
    .select()
    .from(nearbyDestinations)
    .where(and(...where))
    .orderBy(desc(nearbyDestinations.popularity));

  return filters.limit ? query.limit(filters.limit) : query;
}

export async function getNearbyBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(nearbyDestinations)
    .where(eq(nearbyDestinations.slug, slug))
    .limit(1);
  return row ?? null;
}

// Text search over one-day-trip spots — used by the global search so results
// aren't limited to the main `destinations` catalogue.
export async function searchNearby(query: string, limit = 12): Promise<NearbyDestination[]> {
  const q = `%${query.toLowerCase()}%`;
  return db
    .select()
    .from(nearbyDestinations)
    .where(
      and(
        notPermanentlyClosed,
        or(
          like(sql`lower(${nearbyDestinations.name})`, q),
          like(sql`lower(${nearbyDestinations.baseCity})`, q),
          like(sql`lower(${nearbyDestinations.shortDescription})`, q)
        )
      )
    )
    .orderBy(desc(nearbyDestinations.popularity))
    .limit(limit);
}
