import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { destinations, type Destination } from "@/lib/db/schema";

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
          hidden: sql<number>`sum(case when ${destinations.isHidden} then 1 else 0 end)::int`,
          visible: sql<number>`sum(case when ${destinations.isHidden} then 0 else 1 end)::int`,
          avgPopularity: sql<number>`coalesce(round(avg(${destinations.popularity})), 0)::int`,
        })
        .from(destinations),
      db
        .select({
          label: destinations.category,
          total: sql<number>`count(*)::int`,
        })
        .from(destinations)
        .groupBy(destinations.category),
      db
        .select({
          label: destinations.state,
          total: sql<number>`count(*)::int`,
        })
        .from(destinations)
        .groupBy(destinations.state),
      db
        .select({
          label: sql<string>`coalesce(${destinations.placeType}, 'Unspecified')`,
          total: sql<number>`count(*)::int`,
        })
        .from(destinations)
        .groupBy(sql`coalesce(${destinations.placeType}, 'Unspecified')`),
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
        email: sql<string>`coalesce(${destinations.addedByEmail}, 'unknown')`,
        name: sql<string>`coalesce(max(${destinations.addedByName}), 'Unknown')`,
        total: sql<number>`count(*)::int`,
      })
      .from(destinations)
      .groupBy(sql`coalesce(${destinations.addedByEmail}, 'unknown')`);
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
          ilike(destinations.name, term),
          ilike(destinations.district, term),
          ilike(destinations.shortDescription, term)
        )!
      );
    }
    if (filter.state) where.push(eq(destinations.state, filter.state));
    if (filter.category) where.push(eq(destinations.category, filter.category));
    const cond = where.length ? and(...where) : undefined;

    const [countRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(destinations)
      .where(cond);
    const total = countRow?.c ?? 0;

    const rows = await db
      .select()
      .from(destinations)
      .where(cond)
      .orderBy(desc(destinations.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  } catch {
    return { rows: [], total: 0, page, pageSize, pages: 1 };
  }
}

export async function getAdminPlace(id: string): Promise<Destination | null> {
  try {
    const [row] = await db.select().from(destinations).where(eq(destinations.id, id)).limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function placeFacets(): Promise<{ states: string[]; categories: string[] }> {
  try {
    const [states, categories] = await Promise.all([
      db.selectDistinct({ v: destinations.state }).from(destinations).orderBy(destinations.state),
      db.selectDistinct({ v: destinations.category }).from(destinations).orderBy(destinations.category),
    ]);
    return {
      states: states.map((r) => r.v).filter(Boolean),
      categories: categories.map((r) => r.v).filter(Boolean),
    };
  } catch {
    return { states: [], categories: [] };
  }
}

export async function listRecentAdminPlaces(limit = 8): Promise<Destination[]> {
  try {
    return await db
      .select()
      .from(destinations)
      .orderBy(desc(destinations.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}
