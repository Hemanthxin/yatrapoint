import { sql } from "drizzle-orm";
import type { db as Db } from "@/lib/db";

// Food and shopping places near a point, read from our own catalogue.
//
// These used to be fetched live from Overpass on every page render, which
// failed everywhere outside Bengaluru: the catalogue had no rows there, and
// the public mirrors are too slow and too rate-limited to sit in a request
// path. scripts/seed-nearby-poi.ts fills the table from OpenStreetMap ahead of
// time; this reads it back. A live lookup still runs in the browser as a
// top-up, so a place we have not seeded yet is not left blank.

export interface NearbyPoi {
  osmId: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
  distanceKm: number;
  tags: { cuisine?: string; openingHours?: string; website?: string; addrFull?: string };
}

export const FOOD_KINDS = ["restaurant", "cafe", "fast_food"];
export const SHOP_KINDS = ["mall", "marketplace", "market"];

/**
 * Nearest food and shopping places within `radiusKm`.
 *
 * Distance is computed in SQL with the haversine formula, pre-filtered by a
 * cheap bounding box so Postgres can use the lat/lng index instead of running
 * trigonometry over the whole table. The box is deliberately a little generous;
 * the exact distance filter in the outer query trims the corners.
 */
export async function listNearbyPoi(
  db: typeof Db,
  lat: number,
  lng: number,
  radiusKm = 5,
  limit = 60
): Promise<{ food: NearbyPoi[]; shopping: NearbyPoi[] }> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { food: [], shopping: [] };

  // Degrees of latitude are ~111 km everywhere; degrees of longitude shrink
  // with the cosine of the latitude, so the box has to be wider in longitude.
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

  const kinds = [...FOOD_KINDS, ...SHOP_KINDS];

  const res = await db.execute(sql`
    SELECT slug, name, city_kind, area, city, image_url, latitude, longitude, tags,
           6371 * 2 * asin(sqrt(
             power(sin(radians((latitude::float8 - ${lat}) / 2)), 2) +
             cos(radians(${lat})) * cos(radians(latitude::float8)) *
             power(sin(radians((longitude::float8 - ${lng}) / 2)), 2)
           )) AS distance_km
    FROM places
    WHERE is_hidden = false
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND city_kind IN (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})
      AND latitude::float8 BETWEEN ${lat - dLat} AND ${lat + dLat}
      AND longitude::float8 BETWEEN ${lng - dLng} AND ${lng + dLng}
      AND (google_business_status IS NULL OR google_business_status <> 'CLOSED_PERMANENTLY')
    ORDER BY distance_km ASC
    LIMIT ${limit * 2}
  `);

  const rows = (res.rows ?? res) as Array<Record<string, unknown>>;

  const food: NearbyPoi[] = [];
  const shopping: NearbyPoi[] = [];

  for (const r of rows) {
    const distanceKm = Number(r.distance_km);
    if (!Number.isFinite(distanceKm) || distanceKm > radiusKm) continue;

    const kind = String(r.city_kind ?? "");
    const poi: NearbyPoi = {
      osmId: String(r.slug),
      name: String(r.name),
      category: kind,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      imageUrl: (r.image_url as string | null) ?? null,
      distanceKm,
      tags: {
        addrFull: (r.area as string | null) ?? (r.city as string | null) ?? undefined,
        cuisine: (r.tags as string | null) ?? undefined,
      },
    };

    if (FOOD_KINDS.includes(kind)) {
      if (food.length < limit) food.push(poi);
    } else if (SHOP_KINDS.includes(kind)) {
      if (shopping.length < limit) shopping.push(poi);
    }
  }

  return { food, shopping };
}
