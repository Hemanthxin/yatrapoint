import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { places, type Destination } from "@/lib/db/schema";
import { toDestination } from "@/lib/queries/places";

export interface CountBucket {
  label: string;
  total: number;
}

export interface AdminPlaceStats {
  totalPlaces: number;
  hiddenPlaces: number;
  visiblePlaces: number;
  averagePopularity: number;
  byCategory: CountBucket[];
  byState: CountBucket[];
  byPlaceType: CountBucket[];
}

export async function getAdminPlaceStats(): Promise<AdminPlaceStats> {
  try {
    const [totals, categoryRows, stateRows, typeRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          hidden: sql<number>`sum(case when ${places.isHidden} then 1 else 0 end)::int`,
          visible: sql<number>`sum(case when ${places.isHidden} then 0 else 1 end)::int`,
          avgPopularity: sql<number>`coalesce(round(avg(${places.popularity})), 0)::int`,
        })
        .from(places),
      db
        .select({
          label: places.category,
          total: sql<number>`count(*)::int`,
        })
        .from(places)
        .groupBy(places.category),
      db
        .select({
          // A place that isn't a catalogue destination has no state, so
          // coalesce keeps the bucket label a plain string.
          label: sql<string>`coalesce(${places.state}, 'Unspecified')`,
          total: sql<number>`count(*)::int`,
        })
        .from(places)
        .groupBy(sql`coalesce(${places.state}, 'Unspecified')`),
      db
        .select({
          label: sql<string>`coalesce(${places.placeType}, 'Unspecified')`,
          total: sql<number>`count(*)::int`,
        })
        .from(places)
        .groupBy(sql`coalesce(${places.placeType}, 'Unspecified')`),
    ]);

    const total = totals[0]?.total ?? 0;
    const hidden = totals[0]?.hidden ?? 0;
    const visible = totals[0]?.visible ?? 0;
    const averagePopularity = totals[0]?.avgPopularity ?? 0;

    return {
      totalPlaces: total,
      hiddenPlaces: hidden,
      visiblePlaces: visible,
      averagePopularity,
      byCategory: categoryRows.sort((a, b) => b.total - a.total),
      byState: stateRows.sort((a, b) => b.total - a.total).slice(0, 8),
      byPlaceType: typeRows.sort((a, b) => b.total - a.total).slice(0, 8),
    };
  } catch {
    return {
      totalPlaces: 0,
      hiddenPlaces: 0,
      visiblePlaces: 0,
      averagePopularity: 0,
      byCategory: [],
      byState: [],
      byPlaceType: [],
    };
  }
}

export interface AdminContribution {
  email: string;
  name: string;
  total: number;
}

// How many places each admin has added, by the email recorded on each place.
export async function listPlacesByAdmin(): Promise<AdminContribution[]> {
  try {
    const rows = await db
      .select({
        email: sql<string>`coalesce(${places.addedByEmail}, 'unknown')`,
        name: sql<string>`coalesce(max(${places.addedByName}), 'Unknown')`,
        total: sql<number>`count(*)::int`,
      })
      .from(places)
      .groupBy(sql`coalesce(${places.addedByEmail}, 'unknown')`);
    return rows
      .filter((r) => r.email !== "unknown")
      .sort((a, b) => b.total - a.total);
  } catch {
    return [];
  }
}

export interface PlacesPage {
  rows: Destination[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface PlacesFilter {
  q?: string;
  state?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

// Paginated + searchable + filterable listing of every place for the admin.
export async function listAdminPlaces(filter: PlacesFilter = {}): Promise<PlacesPage> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(60, Math.max(6, filter.pageSize ?? 12));
  try {
    const where = [];
    if (filter.q && filter.q.trim()) {
      const term = `%${filter.q.trim()}%`;
      where.push(
        or(
          ilike(places.name, term),
          ilike(places.district, term),
          ilike(places.shortDescription, term)
        )!
      );
    }
    if (filter.state) where.push(eq(places.state, filter.state));
    if (filter.category) where.push(eq(places.category, filter.category));
    const cond = where.length ? and(...where) : undefined;

    const [countRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(places)
      .where(cond);
    const total = countRow?.c ?? 0;

    const rows = await db
      .select()
      .from(places)
      .where(cond)
      .orderBy(desc(places.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { rows: rows.map(toDestination), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  } catch {
    return { rows: [], total: 0, page, pageSize, pages: 1 };
  }
}

export async function getAdminPlace(id: string): Promise<Destination | null> {
  try {
    const [row] = await db.select().from(places).where(eq(places.id, id)).limit(1);
    return row ? toDestination(row) : null;
  } catch {
    return null;
  }
}

export async function placeFacets(): Promise<{ states: string[]; categories: string[] }> {
  try {
    const [states, categories] = await Promise.all([
      db.selectDistinct({ v: places.state }).from(places).orderBy(places.state),
      db.selectDistinct({ v: places.category }).from(places).orderBy(places.category),
    ]);
    return {
      states: states.map((r) => r.v).filter((v): v is string => !!v),
      categories: categories.map((r) => r.v).filter((v): v is string => !!v),
    };
  } catch {
    return { states: [], categories: [] };
  }
}

export async function listRecentAdminPlaces(limit = 8): Promise<Destination[]> {
  try {
    const rows = await db
      .select()
      .from(places)
      .orderBy(desc(places.createdAt))
      .limit(limit);
    return rows.map(toDestination);
  } catch {
    return [];
  }
}
