import { desc, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cityPlaces, type CityPlace } from "@/lib/db/schema";

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
