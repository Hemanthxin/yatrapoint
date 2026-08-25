import { and, desc, eq, gte, inArray, lte, or, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { places, favorites } from "@/lib/db/schema";
import type { Destination } from "@/lib/db/schema";
import { haversineKm } from "@/lib/geo";
import { dedupeCatalogueRows, SOURCE_PRIORITY } from "@/lib/place-dedup";
import { districtKey, districtMatches } from "@/lib/district-match";
import {
  PLACE_KINDS,
  hasKind,
  notPermanentlyClosed,
  toDestination,
} from "@/lib/queries/places";

// Reads the unified `places` table, narrowed to rows that are catalogue
// destinations, and returns them in the original `Destination` shape so callers
// did not have to change when the three catalogues merged.

export interface DestinationFilters {
  category?: string;
  state?: string;
  district?: string;
  query?: string;
  maxBudgetPerDay?: number;
  minBudgetPerDay?: number;
  isHidden?: boolean;
  limit?: number;
  offset?: number;
  // Set false ONLY for admin screens, which must still see a permanently-closed
  // place in order to fix or delete it.
  hideClosed?: boolean;
}

const isDestination = hasKind(PLACE_KINDS.destination);

// Every raw district spelling stored in the catalogue that means the SAME
// district as `district`. The catalogue holds both spellings of several
// districts ("Bagalkot" and "Bagalkote"), so filtering on the one string the
// dropdown happened to show left the other spelling's places out (BUG-09).
async function districtSpellings(district: string, state?: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ district: places.district })
    .from(places)
    .where(state ? and(isDestination, eq(places.state, state)) : isDestination);
  const matches = rows
    .map((r) => r.district)
    .filter((d): d is string => !!d && districtMatches(d, district));
  // Always include what was asked for, so an unknown district filters to
  // nothing rather than silently filtering to everything.
  return matches.length > 0 ? matches : [district];
}

function buildWhere(filters: DestinationFilters, districtOptions?: string[]) {
  const where = [isDestination];
  if (filters.hideClosed !== false) where.push(notPermanentlyClosed);
  if (filters.category) where.push(eq(places.category, filters.category));
  if (filters.state) where.push(eq(places.state, filters.state));
  if (filters.district)
    where.push(inArray(places.district, districtOptions ?? [filters.district]));
  if (filters.maxBudgetPerDay)
    where.push(lte(places.budgetPerDay, filters.maxBudgetPerDay));
  if (filters.minBudgetPerDay)
    where.push(gte(places.budgetPerDay, filters.minBudgetPerDay));
  if (typeof filters.isHidden === "boolean")
    where.push(eq(places.isHidden, filters.isHidden));
  if (filters.query) {
    const q = `%${filters.query.toLowerCase()}%`;
    where.push(
      or(
        like(sql`lower(${places.name})`, q),
        like(sql`lower(${places.state})`, q),
        like(sql`lower(${places.district})`, q),
        like(sql`lower(${places.shortDescription})`, q)
      )!
    );
  }
  return and(...where);
}

export async function listDestinations(
  filters: DestinationFilters = {}
): Promise<Destination[]> {
  const districtOptions = filters.district
    ? await districtSpellings(filters.district, filters.state)
    : undefined;
  const rows = await db
    .select()
    .from(places)
    .where(buildWhere(filters, districtOptions))
    .orderBy(desc(places.popularity))
    .limit(filters.limit ?? 200)
    .offset(filters.offset ?? 0);

  return rows.map(toDestination);
}

// Total count matching the same filters as `listDestinations`, for pagination.
export async function countDestinations(
  filters: DestinationFilters = {}
): Promise<number> {
  const districtOptions = filters.district
    ? await districtSpellings(filters.district, filters.state)
    : undefined;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(places)
    .where(buildWhere(filters, districtOptions));
  return row?.count ?? 0;
}

export async function getDestinationBySlug(slug: string) {
  const [row] = await db.select().from(places).where(eq(places.slug, slug)).limit(1);
  return row ? toDestination(row) : null;
}

export async function listFavoriteIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ destinationId: favorites.destinationId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  return new Set(rows.map((r) => r.destinationId));
}

export async function listFavoritedDestinations(
  userId: string
): Promise<Destination[]> {
  const ids = await db
    .select({ id: favorites.destinationId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(places)
    .where(
      and(
        inArray(
          places.id,
          ids.map((r) => r.id)
        ),
        notPermanentlyClosed
      )
    )
    .orderBy(desc(places.popularity));
  return rows.map(toDestination);
}

// Catalogue places genuinely NEAR a given place, nearest first.
//
// BUG-07: the "More like this" rail on a destination page used to be
// `listDestinations({ category })` — the most popular places of that category
// ANYWHERE IN INDIA. Opening Mysore Palace suggested heritage sites a thousand
// kilometres away. This ranks by real distance from the anchor and never
// returns anything outside `radiusKm`; same-category is only a tie-break.
export async function listDestinationsNear(
  anchor: {
    id?: string;
    latitude: string | null;
    longitude: string | null;
    state?: string;
    district?: string | null;
    category?: string;
  },
  opts: { radiusKm?: number; limit?: number } = {}
): Promise<Array<Destination & { distanceKm: number }>> {
  const radiusKm = opts.radiusKm ?? 150;
  const limit = opts.limit ?? 3;

  const lat = Number(anchor.latitude);
  const lng = Number(anchor.longitude);

  // No usable coordinates on the anchor — fall back to the same district, then
  // the same state. Still genuinely local, unlike a nationwide popularity list.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const local = await listDestinations({
      state: anchor.state,
      district: anchor.district ?? undefined,
      limit: limit + 4,
    });
    return local
      .filter((d) => d.id !== anchor.id)
      .slice(0, limit)
      .map((d) => ({ ...d, distanceKm: 0 }));
  }

  // The destination catalogue is small (a few hundred rows nationwide), so a
  // whole-table read plus an exact distance sort is cheaper and far more
  // accurate than a bounding-box SQL approximation.
  const rows = await db
    .select()
    .from(places)
    .where(and(isDestination, notPermanentlyClosed));

  const near = rows
    .map(toDestination)
    .filter((d) => d.id !== anchor.id && !d.isHidden)
    .map((d) => {
      const dLat = Number(d.latitude);
      const dLng = Number(d.longitude);
      if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) return null;
      return { ...d, distanceKm: haversineKm({ lat, lng }, { lat: dLat, lng: dLng }) };
    })
    .filter((d): d is Destination & { distanceKm: number } => d != null)
    .filter((d) => d.distanceKm <= radiusKm)
    .sort((a, b) => {
      // Nearest first; same category wins only when the two are a similar
      // distance away (within 15 km of each other).
      if (Math.abs(a.distanceKm - b.distanceKm) > 15) return a.distanceKm - b.distanceKm;
      const aSame = anchor.category && a.category === anchor.category ? 0 : 1;
      const bSame = anchor.category && b.category === anchor.category ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      return a.distanceKm - b.distanceKm;
    });

  return dedupeCatalogueRows(near, () => SOURCE_PRIORITY.destination).slice(0, limit);
}

export interface CountsByCategory {
  category: string;
  total: number;
}

export async function countsByCategory(): Promise<CountsByCategory[]> {
  return db
    .select({
      category: places.category,
      total: sql<number>`count(*)::int`,
    })
    .from(places)
    .where(isDestination)
    .groupBy(places.category);
}

export async function listStates(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ state: places.state })
    .from(places)
    .where(and(isDestination, notPermanentlyClosed))
    .orderBy(places.state);
  return rows.map((r) => r.state).filter((s): s is string => !!s && s.trim().length > 0);
}

// Distinct districts present in the catalogue, optionally narrowed to one
// state. Powers the State-page district dropdown.
export async function listDistricts(state?: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ district: places.district })
    .from(places)
    .where(
      state
        ? and(isDestination, notPermanentlyClosed, eq(places.state, state))
        : and(isDestination, notPermanentlyClosed)
    )
    .orderBy(places.district);

  // The catalogue holds two spellings of some districts, so a raw DISTINCT
  // listed e.g. both "Bagalkot" and "Bagalkote" as if they were two different
  // districts — the "duplicate/similarly named locations" half of BUG-09.
  // Collapse them to one entry per real district, keeping the longer (more
  // fully spelled-out) form as the label.
  const byKey = new Map<string, string>();
  for (const r of rows) {
    const d = r.district?.trim();
    if (!d) continue;
    const key = districtKey(d);
    if (!key) continue;
    const held = byKey.get(key);
    if (!held || d.length > held.length) byKey.set(key, d);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
