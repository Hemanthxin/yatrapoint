import { desc, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cityPlaces, type CityPlace } from "@/lib/db/schema";
import type { CategorySlug } from "@/lib/catalog/categories";

// cityPlaces uses its own taxonomy (art/food/heritage/nature/nightlife/
// shopping/spiritual) rather than the main destinations CATEGORIES — only map
// the pairs that are genuinely equivalent, so a "Beach" or "Adventure" filter
// doesn't pull in unrelated city spots just because both loosely say "outdoors".
const CATEGORY_TO_CITY_CATEGORIES: Partial<Record<CategorySlug, string[]>> = {
  heritage: ["heritage"],
  pilgrimage: ["spiritual"],
};

// Text search over in-city places (Bengaluru attractions, restaurants, malls,
// nightlife, etc.) — used by the global search so results aren't limited to
// the main `destinations` catalogue.
export async function searchCityPlaces(query: string, limit = 12): Promise<CityPlace[]> {
  const q = `%${query.toLowerCase()}%`;
  return db
    .select()
    .from(cityPlaces)
    .where(
      or(
        like(sql`lower(${cityPlaces.name})`, q),
        like(sql`lower(${cityPlaces.area})`, q),
        like(sql`lower(${cityPlaces.city})`, q),
        like(sql`lower(${cityPlaces.shortDescription})`, q)
      )
    )
    .orderBy(desc(cityPlaces.popularity))
    .limit(limit);
}

// City places matching a destinations-style category filter — used so
// browsing "/destinations?category=heritage" isn't limited to the main
// destinations table when there's a confident category equivalence.
export async function listCityPlacesByCategory(
  category: CategorySlug,
  limit = 12
): Promise<CityPlace[]> {
  const cityCategories = CATEGORY_TO_CITY_CATEGORIES[category];
  if (!cityCategories || cityCategories.length === 0) return [];
  return db
    .select()
    .from(cityPlaces)
    .where(inArray(cityPlaces.category, cityCategories))
    .orderBy(desc(cityPlaces.popularity))
    .limit(limit);
}
