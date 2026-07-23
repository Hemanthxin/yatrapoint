import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { nearbyDestinations, type NearbyDestination } from "@/lib/db/schema";

export interface NearbyFilters {
  baseCity?: string;
  category?: string;
  maxDistanceKm?: number;
}

export async function listNearby(
  filters: NearbyFilters = {}
): Promise<NearbyDestination[]> {
  const where = [];
  if (filters.baseCity) where.push(eq(nearbyDestinations.baseCity, filters.baseCity));
  if (filters.category) where.push(eq(nearbyDestinations.category, filters.category));

  return db
    .select()
    .from(nearbyDestinations)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(nearbyDestinations.popularity));
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
      or(
        like(sql`lower(${nearbyDestinations.name})`, q),
        like(sql`lower(${nearbyDestinations.baseCity})`, q),
        like(sql`lower(${nearbyDestinations.shortDescription})`, q)
      )
    )
    .orderBy(desc(nearbyDestinations.popularity))
    .limit(limit);
}
