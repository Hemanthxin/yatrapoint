import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { places, type CityPlace } from "@/lib/db/schema";
import type { CategorySlug } from "@/lib/catalog/categories";
import {
  PLACE_KINDS,
  hasKind,
  notPermanentlyClosed,
  slugMatches,
  toCityPlace,
} from "@/lib/queries/places";

// In-city places (Bengaluru attractions, restaurants, malls, nightlife…), read
// from the unified `places` table and returned in the original CityPlace shape.

// cityPlaces uses its own taxonomy (art/food/heritage/nature/nightlife/
// shopping/spiritual) rather than the main destinations CATEGORIES — only map
// the pairs that are genuinely equivalent, so a "Beach" or "Adventure" filter
// doesn't pull in unrelated city spots just because both loosely say "outdoors".
const CATEGORY_TO_CITY_CATEGORIES: Partial<Record<CategorySlug, string[]>> = {
  heritage: ["heritage"],
  pilgrimage: ["spiritual"],
};

const isCityPlace = hasKind(PLACE_KINDS.city);

export async function searchCityPlaces(query: string, limit = 12): Promise<CityPlace[]> {
  const q = `%${query.toLowerCase()}%`;
  const rows = await db
    .select()
    .from(places)
    .where(
      and(
        isCityPlace,
        notPermanentlyClosed,
        or(
          like(sql`lower(${places.name})`, q),
          like(sql`lower(${places.area})`, q),
          like(sql`lower(${places.city})`, q),
          like(sql`lower(${places.shortDescription})`, q)
        )
      )
    )
    .orderBy(desc(places.popularity), places.id)
    .limit(limit);
  return rows.map(toCityPlace);
}

// City places matching a destinations-style category filter — used so browsing
// "/destinations?category=heritage" isn't limited to the main catalogue when
// there's a confident category equivalence.
export async function listCityPlacesByCategory(
  category: CategorySlug,
  limit = 12
): Promise<CityPlace[]> {
  const cityCategories = CATEGORY_TO_CITY_CATEGORIES[category];
  if (!cityCategories || cityCategories.length === 0) return [];
  const rows = await db
    .select()
    .from(places)
    .where(and(isCityPlace, notPermanentlyClosed, inArray(places.category, cityCategories)))
    .orderBy(desc(places.popularity), places.id)
    .limit(limit);
  return rows.map(toCityPlace);
}

export async function getCityPlaceBySlug(slug: string): Promise<CityPlace | null> {
  const [row] = await db
    .select()
    .from(places)
    .where(and(isCityPlace, slugMatches(slug)))
    .limit(1);
  return row ? toCityPlace(row) : null;
}

// Popularity slice used for first paint on the explore screen.
export async function listPopularCityPlaces(limit = 60): Promise<CityPlace[]> {
  const rows = await db
    .select()
    .from(places)
    .where(and(isCityPlace, notPermanentlyClosed))
    .orderBy(desc(places.popularity), places.id)
    .limit(limit);
  return rows.map(toCityPlace);
}

export async function listCityPlacesByKinds(kinds: string[], limit = 200): Promise<CityPlace[]> {
  if (kinds.length === 0) return [];
  const rows = await db
    .select()
    .from(places)
    .where(and(isCityPlace, notPermanentlyClosed, inArray(places.cityKind, kinds)))
    .orderBy(desc(places.popularity), places.id)
    .limit(limit);
  return rows.map(toCityPlace);
}

export { eq };
