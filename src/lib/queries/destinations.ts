import { and, desc, eq, gte, inArray, lte, or, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { destinations, favorites } from "@/lib/db/schema";
import type { Destination } from "@/lib/db/schema";

export interface DestinationFilters {
  category?: string;
  state?: string;
  district?: string;
  query?: string;
  maxBudgetPerDay?: number;
  minBudgetPerDay?: number;
  isHidden?: boolean;
  limit?: number;
}

export async function listDestinations(
  filters: DestinationFilters = {}
): Promise<Destination[]> {
  const where = [];
  if (filters.category) where.push(eq(destinations.category, filters.category));
  if (filters.state) where.push(eq(destinations.state, filters.state));
  if (filters.district)
    where.push(eq(destinations.district, filters.district));
  if (filters.maxBudgetPerDay)
    where.push(lte(destinations.budgetPerDay, filters.maxBudgetPerDay));
  if (filters.minBudgetPerDay)
    where.push(gte(destinations.budgetPerDay, filters.minBudgetPerDay));
  if (typeof filters.isHidden === "boolean")
    where.push(eq(destinations.isHidden, filters.isHidden));
  if (filters.query) {
    const q = `%${filters.query.toLowerCase()}%`;
    where.push(
      or(
        like(sql`lower(${destinations.name})`, q),
        like(sql`lower(${destinations.state})`, q),
        like(sql`lower(${destinations.district})`, q),
        like(sql`lower(${destinations.shortDescription})`, q)
      )!
    );
  }

  const rows = await db
    .select()
    .from(destinations)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(destinations.popularity))
    .limit(filters.limit ?? 200);

  return rows;
}

export async function getDestinationBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(destinations)
    .where(eq(destinations.slug, slug))
    .limit(1);
  return row ?? null;
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
  return db
    .select()
    .from(destinations)
    .where(
      inArray(
        destinations.id,
        ids.map((r) => r.id)
      )
    )
    .orderBy(desc(destinations.popularity));
}

export interface CountsByCategory {
  category: string;
  total: number;
}

export async function countsByCategory(): Promise<CountsByCategory[]> {
  const rows = await db
    .select({
      category: destinations.category,
      total: sql<number>`count(*)::int`,
    })
    .from(destinations)
    .groupBy(destinations.category);
  return rows;
}

export async function listStates(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ state: destinations.state })
    .from(destinations)
    .orderBy(destinations.state);
  return rows.map((r) => r.state);
}

// Distinct districts present in the catalogue — the same places the budget
// planner draws from — optionally narrowed to one state. Powers the State-page
// district dropdown so every catalogue place is filterable by its district.
export async function listDistricts(state?: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ district: destinations.district })
    .from(destinations)
    .where(state ? eq(destinations.state, state) : undefined)
    .orderBy(destinations.district);
  return rows
    .map((r) => r.district)
    .filter((d): d is string => !!d && d.trim().length > 0);
}
