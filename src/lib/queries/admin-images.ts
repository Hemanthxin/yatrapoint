import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { PLACE_KINDS, kindsOf, type PlaceKindName } from "@/lib/queries/places";

// Every place now lives in one table, so a photo has exactly one place to
// attach to. `ImageSource` is kept as a single value rather than removed, so
// the polymorphic `place_images.placeType` column still has a meaningful value
// and older call sites keep compiling.
export type ImageSource = "place";
export const IMAGE_SOURCE: ImageSource = "place";

export interface AdminImageRow {
  id: string;
  source: ImageSource;
  name: string;
  // State/district, base city, or city/area — whatever locates it.
  area: string | null;
  imageUrl: string | null;
  // Which catalogues this place belongs to, so the admin card can still badge
  // it "Destination" / "One-day trip" / "City place" — one card, all its roles.
  // Previously the same place produced one card PER table, which is what made
  // the admin screen show a fort twice with the photos on only one of them.
  kinds: PlaceKindName[];
}

const LIMIT = 24;

function toRow(r: typeof places.$inferSelect): AdminImageRow {
  const kinds = kindsOf(r);
  const area = kinds.includes(PLACE_KINDS.destination)
    ? [r.district, r.state].filter(Boolean).join(", ") || null
    : kinds.includes(PLACE_KINDS.dayTrip)
    ? r.baseCity
      ? `Near ${r.baseCity}`
      : null
    : r.area || r.city || null;
  return { id: r.id, source: IMAGE_SOURCE, name: r.name, area, imageUrl: r.imageUrl, kinds };
}

// Search the catalogue by name. One row per real place.
export async function searchPlacesForImages(query: string): Promise<AdminImageRow[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const rows = await db
      .select()
      .from(places)
      .where(ilike(places.name, `%${q}%`))
      .orderBy(desc(places.popularity))
      .limit(45);
    return rows.map(toRow);
  } catch {
    return [];
  }
}

// Default worklist when no search query is typed yet — the places most worth
// fixing first: popular, visible spots that still have no photo at all.
export async function listPlacesMissingImages(limit = LIMIT): Promise<AdminImageRow[]> {
  try {
    const rows = await db
      .select()
      .from(places)
      .where(and(isNull(places.imageUrl), eq(places.isHidden, false)))
      .orderBy(desc(places.popularity))
      .limit(limit);
    return rows.map(toRow);
  } catch {
    return [];
  }
}
