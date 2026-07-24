import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { longTripTemplates, savedLongTrips, type LongTripTemplate } from "@/lib/db/schema";

export interface DayPlan {
  day: number;
  items: string[];
}

export function parseItinerary(raw: string): DayPlan[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Distinct states with at least one long-trip template, in a fixed display
// order (matches how the itineraries were authored) rather than alphabetical.
const STATE_ORDER = ["Karnataka", "Tamil Nadu", "Kerala", "Andhra Pradesh", "Maharashtra"];

export async function listLongTripStates(): Promise<string[]> {
  const rows = await db.selectDistinct({ state: longTripTemplates.state }).from(longTripTemplates);
  const states = rows.map((r) => r.state);
  return STATE_ORDER.filter((s) => states.includes(s)).concat(
    states.filter((s) => !STATE_ORDER.includes(s))
  );
}

export async function listLongTripsByState(state: string): Promise<LongTripTemplate[]> {
  return db
    .select()
    .from(longTripTemplates)
    .where(eq(longTripTemplates.state, state))
    .orderBy(longTripTemplates.days);
}

export async function getLongTripBySlug(slug: string): Promise<LongTripTemplate | null> {
  const [row] = await db
    .select()
    .from(longTripTemplates)
    .where(eq(longTripTemplates.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function listSavedLongTripIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ longTripId: savedLongTrips.longTripId })
    .from(savedLongTrips)
    .where(eq(savedLongTrips.userId, userId));
  return new Set(rows.map((r) => r.longTripId));
}

export async function listSavedLongTrips(userId: string): Promise<LongTripTemplate[]> {
  const ids = await db
    .select({ id: savedLongTrips.longTripId })
    .from(savedLongTrips)
    .where(eq(savedLongTrips.userId, userId));
  if (ids.length === 0) return [];
  return db
    .select()
    .from(longTripTemplates)
    .where(inArray(longTripTemplates.id, ids.map((r) => r.id)))
    .orderBy(desc(longTripTemplates.popularity));
}
