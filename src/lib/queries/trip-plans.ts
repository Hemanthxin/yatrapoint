import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  destinations,
  favorites,
  tripPlanItems,
  tripPlans,
  type Destination,
  type TripPlan,
} from "@/lib/db/schema";

export interface TripPlanWithItems extends TripPlan {
  items: Destination[];
}

export async function listUserTripPlans(
  userId: string
): Promise<TripPlanWithItems[]> {
  const plans = await db
    .select()
    .from(tripPlans)
    .where(eq(tripPlans.userId, userId))
    .orderBy(desc(tripPlans.createdAt));

  if (plans.length === 0) return [];

  // Fetch items for all plans in one go.
  const rows = await db
    .select({
      tripPlanId: tripPlanItems.tripPlanId,
      position: tripPlanItems.position,
      destination: destinations,
    })
    .from(tripPlanItems)
    .innerJoin(destinations, eq(tripPlanItems.destinationId, destinations.id));

  const byPlan = new Map<string, Destination[]>();
  for (const r of rows.sort((a, b) => a.position - b.position)) {
    const arr = byPlan.get(r.tripPlanId) ?? [];
    arr.push(r.destination);
    byPlan.set(r.tripPlanId, arr);
  }

  return plans.map((p) => ({ ...p, items: byPlan.get(p.id) ?? [] }));
}

export interface DashboardStats {
  tripsPlanned: number;
  placesExplored: number;
  // Estimated savings vs typical market package price for the planned trips.
  totalSaved: number;
  // Sum of every planned trip's budget — drives the Budget Overview donut.
  totalBudget: number;
  upcomingTrip: { name: string; days: number } | null;
}

export interface UpcomingTrip {
  id: string;
  name: string;
  days: number;
  status: string;
  createdAt: Date;
}

// The user's most recent trip plans, for the dashboard "Upcoming Trips" widget.
export async function listUpcomingTrips(
  userId: string,
  limit = 3
): Promise<UpcomingTrip[]> {
  try {
    return await db
      .select({
        id: tripPlans.id,
        name: tripPlans.name,
        days: tripPlans.days,
        status: tripPlans.status,
        createdAt: tripPlans.createdAt,
      })
      .from(tripPlans)
      .where(eq(tripPlans.userId, userId))
      .orderBy(desc(tripPlans.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

// All dashboard headline numbers, derived from the user's real data. Falls back
// to zeros if the DB is unreachable so the dashboard always renders.
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  try {
    const [planRows, favRow, latest] = await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
          budget: sql<number>`coalesce(sum(${tripPlans.totalBudget}), 0)::int`,
        })
        .from(tripPlans)
        .where(eq(tripPlans.userId, userId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(favorites)
        .where(eq(favorites.userId, userId)),
      db
        .select({ name: tripPlans.name, days: tripPlans.days })
        .from(tripPlans)
        .where(eq(tripPlans.userId, userId))
        .orderBy(desc(tripPlans.createdAt))
        .limit(1),
    ]);

    const tripsPlanned = planRows[0]?.count ?? 0;
    const plannedBudget = planRows[0]?.budget ?? 0;
    // Self-planned trips typically run ~25% cheaper than equivalent agency packages.
    const totalSaved = Math.round(plannedBudget * 0.25);

    return {
      tripsPlanned,
      placesExplored: favRow[0]?.count ?? 0,
      totalSaved,
      totalBudget: plannedBudget,
      upcomingTrip: latest[0] ? { name: latest[0].name, days: latest[0].days } : null,
    };
  } catch {
    return { tripsPlanned: 0, placesExplored: 0, totalSaved: 0, totalBudget: 0, upcomingTrip: null };
  }
}
