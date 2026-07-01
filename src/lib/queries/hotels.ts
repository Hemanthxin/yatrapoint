import { and, asc, desc, gte, ilike, isNotNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { hotels, type Hotel } from "@/lib/db/schema";

export interface HotelFilters {
  q?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: "price" | "-price" | "rating" | "popular";
  page?: number;
  pageSize?: number;
}

export interface HotelListResult {
  rows: Hotel[];
  total: number;
  page: number;
  pages: number;
}

export async function listHotels(f: HotelFilters = {}): Promise<HotelListResult> {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, f.pageSize ?? 24));
  const where = [] as ReturnType<typeof gte>[];

  if (f.q) {
    const like = `%${f.q}%`;
    where.push(
      or(ilike(hotels.name, like), ilike(hotels.city, like), ilike(hotels.area, like))!
    );
  }
  if (f.city) where.push(ilike(hotels.city, `%${f.city}%`));
  if (f.minPrice != null) where.push(gte(hotels.pricePerNight, f.minPrice));
  if (f.maxPrice != null) where.push(lte(hotels.pricePerNight, f.maxPrice));
  if (f.minRating != null) where.push(gte(hotels.rating, f.minRating));

  const whereClause = where.length ? and(...where) : undefined;

  // Sort. "popular" = has rating + reviews first; default keeps priced first.
  const order =
    f.sort === "price"
      ? [asc(sql`${hotels.pricePerNight} nulls last`)]
      : f.sort === "-price"
      ? [desc(sql`${hotels.pricePerNight} nulls last`)]
      : f.sort === "rating"
      ? [desc(sql`${hotels.rating} nulls last`)]
      : [desc(sql`${hotels.reviews} nulls last`), desc(sql`${hotels.rating} nulls last`)];

  try {
    const [rows, [{ n }]] = await Promise.all([
      db
        .select()
        .from(hotels)
        .where(whereClause)
        .orderBy(...order)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ n: sql<number>`count(*)::int` }).from(hotels).where(whereClause),
    ]);
    return { rows, total: n, page, pages: Math.max(1, Math.ceil(n / pageSize)) };
  } catch {
    return { rows: [], total: 0, page: 1, pages: 1 };
  }
}

// Top cities (by hotel count) for the filter dropdown.
export async function hotelCities(limit = 40): Promise<{ city: string; count: number }[]> {
  try {
    const rows = await db
      .select({ city: hotels.city, count: sql<number>`count(*)::int` })
      .from(hotels)
      .where(isNotNull(hotels.city))
      .groupBy(hotels.city)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows.filter((r) => r.city).map((r) => ({ city: r.city as string, count: r.count }));
  } catch {
    return [];
  }
}

// Median nightly rate for the budget planner's stay cost. Filters by city when
// given (most priced rows are Bengaluru); falls back to the overall median.
export async function estimateNightlyRate(city?: string): Promise<number> {
  try {
    const base = [isNotNull(hotels.pricePerNight), gte(hotels.pricePerNight, 200)];
    const run = async (withCity: boolean) => {
      const where = withCity && city ? and(...base, ilike(hotels.city, `%${city}%`)) : and(...base);
      const rows = await db
        .select({ p: hotels.pricePerNight })
        .from(hotels)
        .where(where)
        .orderBy(asc(hotels.pricePerNight))
        .limit(600);
      return rows.map((r) => r.p as number).filter((n) => Number.isFinite(n));
    };
    let prices = city ? await run(true) : [];
    if (prices.length < 5) prices = await run(false);
    if (prices.length === 0) return 1800; // sensible default
    return prices[Math.floor(prices.length / 2)];
  } catch {
    return 1800;
  }
}

// A concrete mid-range hotel to recommend for the night stay in a budget plan.
// Prefers a priced (₹800–4000), well-rated property in the trip's city.
export async function suggestStayHotel(city?: string): Promise<Hotel | null> {
  try {
    const base = [
      isNotNull(hotels.pricePerNight),
      gte(hotels.pricePerNight, 800),
      lte(hotels.pricePerNight, 4000),
    ];
    const pick = async (withCity: boolean): Promise<Hotel | null> => {
      const where = withCity && city ? and(...base, ilike(hotels.city, `%${city}%`)) : and(...base);
      const rows = await db
        .select()
        .from(hotels)
        .where(where)
        .orderBy(desc(sql`${hotels.rating} nulls last`), asc(hotels.pricePerNight))
        .limit(1);
      return rows[0] ?? null;
    };
    return (city ? await pick(true) : null) ?? (await pick(false));
  } catch {
    return null;
  }
}
