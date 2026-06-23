import { desc, eq, sql } from "drizzle-orm";
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
