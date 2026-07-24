"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { savedLongTrips, tripHistory, longTripTemplates } from "@/lib/db/schema";

export async function toggleSaveLongTrip(longTripId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Not signed in" };
  const userId = session.user.id;

  const existing = await db
    .select()
    .from(savedLongTrips)
    .where(and(eq(savedLongTrips.userId, userId), eq(savedLongTrips.longTripId, longTripId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(savedLongTrips)
      .where(and(eq(savedLongTrips.userId, userId), eq(savedLongTrips.longTripId, longTripId)));
    revalidatePath("/budget-planner");
    return { ok: true as const, saved: false };
  }

  await db.insert(savedLongTrips).values({ userId, longTripId });
  revalidatePath("/budget-planner");
  return { ok: true as const, saved: true };
}

// Logs that a user opened/generated a plan — powers the "Trip history" list.
// Called from the long-trip detail page on view, and can be reused for
// computed budget-planner runs (kind: "budget-plan").
export async function logTripHistory(input: {
  kind: "long-trip" | "budget-plan";
  refSlug?: string;
  title: string;
  snapshot?: unknown;
}) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const };

  await db.insert(tripHistory).values({
    userId: session.user.id,
    kind: input.kind,
    refSlug: input.refSlug ?? null,
    title: input.title,
    snapshot: input.snapshot ? JSON.stringify(input.snapshot) : null,
  });
  return { ok: true as const };
}

export async function clearTripHistory() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Not signed in" };
  await db.delete(tripHistory).where(eq(tripHistory.userId, session.user.id));
  revalidatePath("/trip-history");
  return { ok: true as const };
}

export async function deleteTripHistoryItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Not signed in" };
  await db.delete(tripHistory).where(and(eq(tripHistory.id, id), eq(tripHistory.userId, session.user.id)));
  revalidatePath("/trip-history");
  return { ok: true as const };
}

// So an admin/import script can look up a template's id from its slug when
// logging history right after generating/opening a plan.
export async function getLongTripId(slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: longTripTemplates.id })
    .from(longTripTemplates)
    .where(eq(longTripTemplates.slug, slug))
    .limit(1);
  return row?.id ?? null;
}
