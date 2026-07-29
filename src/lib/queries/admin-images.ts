import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { destinations, nearbyDestinations, cityPlaces } from "@/lib/db/schema";

export type ImageSource = "destination" | "nearby" | "city";

export interface AdminImageRow {
  id: string;
  source: ImageSource;
  name: string;
  area: string | null; // state/district, or base city, or city/area — whatever locates it
  imageUrl: string | null;
}

const LIMIT_PER_TABLE = 15;

// Search all three place catalogues by name, tagging each row with which
// table it came from so a single admin screen can fix images anywhere.
export async function searchPlacesForImages(query: string): Promise<AdminImageRow[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const [dest, nearby, city] = await Promise.all([
      db
        .select({ id: destinations.id, name: destinations.name, state: destinations.state, district: destinations.district, imageUrl: destinations.imageUrl })
        .from(destinations)
        .where(ilike(destinations.name, `%${q}%`))
        .limit(LIMIT_PER_TABLE),
      db
        .select({ id: nearbyDestinations.id, name: nearbyDestinations.name, baseCity: nearbyDestinations.baseCity, imageUrl: nearbyDestinations.imageUrl })
        .from(nearbyDestinations)
        .where(ilike(nearbyDestinations.name, `%${q}%`))
        .limit(LIMIT_PER_TABLE),
      db
        .select({ id: cityPlaces.id, name: cityPlaces.name, city: cityPlaces.city, area: cityPlaces.area, imageUrl: cityPlaces.imageUrl })
        .from(cityPlaces)
        .where(ilike(cityPlaces.name, `%${q}%`))
        .limit(LIMIT_PER_TABLE),
    ]);

    return [
      ...dest.map((r) => ({ id: r.id, source: "destination" as const, name: r.name, area: [r.district, r.state].filter(Boolean).join(", ") || null, imageUrl: r.imageUrl })),
      ...nearby.map((r) => ({ id: r.id, source: "nearby" as const, name: r.name, area: r.baseCity ? `Near ${r.baseCity}` : null, imageUrl: r.imageUrl })),
      ...city.map((r) => ({ id: r.id, source: "city" as const, name: r.name, area: r.area || r.city || null, imageUrl: r.imageUrl })),
    ];
  } catch {
    return [];
  }
}

// Default worklist when no search query is typed yet — the places most worth
// fixing first: popular, curated spots that still have no photo at all.
export async function listPlacesMissingImages(limit = 24): Promise<AdminImageRow[]> {
  try {
    const [dest, nearby] = await Promise.all([
      db
        .select({ id: destinations.id, name: destinations.name, state: destinations.state, district: destinations.district, imageUrl: destinations.imageUrl })
        .from(destinations)
        .where(and(isNull(destinations.imageUrl), eq(destinations.isHidden, false)))
        .orderBy(desc(destinations.popularity))
        .limit(limit),
      db
        .select({ id: nearbyDestinations.id, name: nearbyDestinations.name, baseCity: nearbyDestinations.baseCity, imageUrl: nearbyDestinations.imageUrl })
        .from(nearbyDestinations)
        .where(isNull(nearbyDestinations.imageUrl))
        .orderBy(desc(nearbyDestinations.popularity))
        .limit(limit),
    ]);

    return [
      ...dest.map((r) => ({ id: r.id, source: "destination" as const, name: r.name, area: [r.district, r.state].filter(Boolean).join(", ") || null, imageUrl: r.imageUrl })),
      ...nearby.map((r) => ({ id: r.id, source: "nearby" as const, name: r.name, area: r.baseCity ? `Near ${r.baseCity}` : null, imageUrl: r.imageUrl })),
    ].slice(0, limit);
  } catch {
    return [];
  }
}
