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

export interface ImageFilter {
  query?: string;
  state?: string;
  district?: string;
  // Only places that still have no photo. This is the default worklist; a
  // search or a filter can widen it to everything.
  missingOnly?: boolean;
}

// One builder for both the worklist and search, so a filter behaves the same
// whichever the admin is looking at.
function whereFor(f: ImageFilter) {
  const parts = [];
  const q = f.query?.trim();
  if (q) parts.push(ilike(places.name, `%${q}%`));
  if (f.state) parts.push(eq(places.state, f.state));
  if (f.district) parts.push(eq(places.district, f.district));
  if (f.missingOnly) parts.push(isNull(places.imageUrl));
  parts.push(eq(places.isHidden, false));
  return and(...parts);
}

/**
 * Places to show on the photo screen.
 *
 * With nothing selected this is the worklist — popular visible places that
 * still have no photo. A name search, a state, or a district narrows it; the
 * catalogue now runs to 20,000 places across a dozen states, so scrolling to
 * find the one you want was not workable.
 */
export async function listPlacesForImages(
  f: ImageFilter = {},
  limit = 45
): Promise<AdminImageRow[]> {
  try {
    const rows = await db
      .select()
      .from(places)
      .where(whereFor(f))
      .orderBy(desc(places.popularity))
      .limit(limit);
    return rows.map(toRow);
  } catch {
    return [];
  }
}

// Search the catalogue by name. One row per real place.
export async function searchPlacesForImages(
  query: string,
  f: Omit<ImageFilter, "query"> = {}
): Promise<AdminImageRow[]> {
  const q = query.trim();
  if (!q) return [];
  return listPlacesForImages({ ...f, query: q }, 45);
}

// Default worklist when nothing is typed or selected.
export async function listPlacesMissingImages(
  limit = LIMIT,
  f: Omit<ImageFilter, "missingOnly"> = {}
): Promise<AdminImageRow[]> {
  return listPlacesForImages({ ...f, missingOnly: true }, limit);
}

/**
 * The states, and the districts within one state, that the filters offer.
 *
 * Districts are scoped to the selected state on purpose: unscoped there are
 * several hundred of them, and names repeat across states.
 */
export async function listImageFacets(
  state?: string
): Promise<{ states: string[]; districts: string[] }> {
  try {
    const [stateRows, districtRows] = await Promise.all([
      db
        .selectDistinct({ v: places.state })
        .from(places)
        .where(eq(places.isHidden, false))
        .orderBy(places.state),
      state
        ? db
            .selectDistinct({ v: places.district })
            .from(places)
            .where(and(eq(places.state, state), eq(places.isHidden, false)))
            .orderBy(places.district)
        : Promise.resolve([] as Array<{ v: string | null }>),
    ]);
    return {
      states: stateRows.map((r) => r.v).filter((v): v is string => !!v),
      districts: districtRows.map((r) => r.v).filter((v): v is string => !!v),
    };
  } catch {
    return { states: [], districts: [] };
  }
}
