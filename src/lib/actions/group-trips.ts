"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { groupTrips, groupTripMembers, groupTripPlaces, groupTripVotes, places } from "@/lib/db/schema";
import type { VehicleKind } from "@/lib/budget";
import { travelCostFor, isBengaluru } from "@/lib/transport";
import { fetchTrip } from "@/lib/routing";
import { haversineKm, type LatLng } from "@/lib/geo";
import { bucketStopsByDay, GROUP_FOOD_PER_PERSON_PER_DAY, type GeneratedItinerary, type ItineraryStop } from "@/lib/itinerary";
import { listDistricts } from "@/lib/queries/destinations";
import { searchPlaces } from "@/lib/queries/places";

// Thin server-action wrapper so the (client) create-trip form can fetch a
// state's districts without a dedicated API route — `listDistricts` itself
// lives in a server-only query module.
export async function listDistrictsForState(state: string): Promise<string[]> {
  return listDistricts(state);
}

export interface PlaceSearchHit {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  shortDescription: string;
  entryFeePerPerson: number;
  googleRating: number | null;
  district: string | null;
  state: string | null;
}

// Search-as-you-type for the Add Places tab — same ranked search the main
// Destinations page uses.
export async function searchPlacesForGroupTrip(query: string): Promise<PlaceSearchHit[]> {
  if (!query.trim()) return [];
  const results = await searchPlaces(db, query, { limit: 20 });
  return results.map((r) => ({
    id: r.place.id,
    name: r.place.name,
    category: r.place.category,
    imageUrl: r.place.imageUrl,
    shortDescription: r.place.shortDescription,
    entryFeePerPerson: r.place.entryFeePerPerson,
    googleRating: r.place.googleRating,
    district: r.place.district,
    state: r.place.state,
  }));
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Human-shareable join code: no 0/O/1/I, which are easy to misread when
// spoken or copied off a screenshot.
const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomJoinCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  return out;
}

const VEHICLE_KINDS = ["bike", "small_car", "sedan", "suv", "cab"] as const;

// Neon's HTTP driver occasionally hits a one-off connection timeout/blip
// (observed directly while debugging this: a plain SELECT threw
// `ConnectTimeoutError` once, then succeeded immediately on retry with no
// code change). That's not a missing-table problem, so a single quick retry
// before giving up avoids surfacing a transient hiccup as "create trip
// failed" — the schema itself is fine; the network call just needs another
// try.
function isTransientDbError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message} ${err.cause ?? ""}` : String(err);
  return /fetch failed|ConnectTimeout|ETIMEDOUT|ECONNRESET|fetch error/i.test(msg);
}

// Sessions here are JWT cookies (no server-side session table), so deleting
// or recreating a `users` row doesn't invalidate a browser's existing
// cookie — it keeps "working" (the JWT signature still checks out) but now
// names a creator_id that no longer exists, which this FK violation catches
// at the DB layer. Confirmed live: the reporting account's email wasn't in
// `users` at all when this fired. The fix is a fresh sign-in, not db:push.
function isStaleSessionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /group_trips_creator_id_fkey|violates foreign key constraint.*creator_id/i.test(msg);
}

// A short, safe snippet of the real error — stripped of anything that could
// be a connection string/credential — appended to the user-facing message so
// the NEXT failure is actually diagnosable from a screenshot, instead of
// guessing blind again (this exact bug has resisted two earlier fixes
// because the generic message gives no signal about what actually failed).
function safeErrorDetail(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const stripped = raw.replace(/[a-z0-9+.-]+:\/\/[^\s)]+/gi, "[redacted]");
  return stripped.slice(0, 160);
}

const createGroupTripSchema = z.object({
  name: z.string().min(2).max(140),
  startLabel: z.string().min(2).max(200),
  startLatitude: z.number().gte(-90).lte(90).optional(),
  startLongitude: z.number().gte(-180).lte(180).optional(),
  destinationState: z.string().min(1).max(80),
  destinationDistrict: z.string().max(80).optional(),
  destinationLabel: z.string().min(1).max(200),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  days: z.number().int().min(1).max(30),
  travellers: z.number().int().min(1).max(30),
  totalBudget: z.number().int().min(500).max(10_000_000),
  vehicle: z.enum(VEHICLE_KINDS),
});
export type CreateGroupTripInput = z.infer<typeof createGroupTripSchema>;

export async function createGroupTrip(
  input: CreateGroupTripInput
): Promise<ActionResult & { joinCode?: string; id?: string }> {
  const parsed = createGroupTripSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in first." };

  const d = parsed.data;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      let joinCode = randomJoinCode();
      for (let tries = 0; tries < 6; tries++) {
        const exists = await db.select({ id: groupTrips.id }).from(groupTrips).where(eq(groupTrips.joinCode, joinCode)).limit(1);
        if (exists.length === 0) break;
        joinCode = randomJoinCode();
      }

      const [created] = await db
        .insert(groupTrips)
        .values({
          joinCode,
          name: d.name,
          creatorId: session.user.id,
          startLabel: d.startLabel,
          startLatitude: d.startLatitude != null ? String(d.startLatitude) : null,
          startLongitude: d.startLongitude != null ? String(d.startLongitude) : null,
          destinationState: d.destinationState,
          destinationDistrict: d.destinationDistrict || null,
          destinationLabel: d.destinationLabel,
          startDate: d.startDate || null,
          endDate: d.endDate || null,
          days: d.days,
          travellers: d.travellers,
          totalBudget: d.totalBudget,
          vehicle: d.vehicle,
        })
        .returning({ id: groupTrips.id, joinCode: groupTrips.joinCode });
      if (!created) return { ok: false, error: "Could not create the trip." };

      // No db.transaction here — same reason as createCommunity (neon-http
      // driver, no transaction support used anywhere in this codebase); a
      // failure past this point is a hard error rather than a silent partial
      // trip, same tradeoff already accepted for communities.
      await db.insert(groupTripMembers).values({ groupTripId: created.id, userId: session.user.id, role: "admin" });

      revalidatePath("/group-trip");
      return { ok: true, joinCode: created.joinCode, id: created.id };
    } catch (err) {
      if (isStaleSessionError(err)) {
        console.error("[createGroupTrip] stale session (creator_id has no matching user row):", err);
        return { ok: false, error: "Your session has expired — please sign out and sign back in, then try again." };
      }
      const canRetry = attempt === 1 && isTransientDbError(err);
      console.error(`[createGroupTrip] failed (attempt ${attempt}${canRetry ? ", retrying" : ""}):`, err);
      if (!canRetry) {
        return {
          ok: false,
          error: `Could not create the trip (${safeErrorDetail(err)}). Run db:push if you just added the tables.`,
        };
      }
    }
  }
  return { ok: false, error: "Could not create the trip. Run db:push if you just added the tables." };
}

export async function joinGroupTripByCode(joinCode: string): Promise<ActionResult & { id?: string; joinCode?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in first." };
  const me = session.user.id;
  const code = joinCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter an invite code." };

  try {
    const [trip] = await db
      .select({ id: groupTrips.id, joinCode: groupTrips.joinCode, travellers: groupTrips.travellers })
      .from(groupTrips)
      .where(eq(groupTrips.joinCode, code))
      .limit(1);
    if (!trip) return { ok: false, error: "That invite link isn't valid." };

    const [existing] = await db
      .select({ userId: groupTripMembers.userId })
      .from(groupTripMembers)
      .where(and(eq(groupTripMembers.groupTripId, trip.id), eq(groupTripMembers.userId, me)))
      .limit(1);
    if (existing) return { ok: true, id: trip.id, joinCode: trip.joinCode };

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupTripMembers)
      .where(eq(groupTripMembers.groupTripId, trip.id));
    if (count >= trip.travellers) return { ok: false, error: "This trip is already full." };

    await db.insert(groupTripMembers).values({ groupTripId: trip.id, userId: me, role: "member" });
    revalidatePath("/group-trip");
    return { ok: true, id: trip.id, joinCode: trip.joinCode };
  } catch (err) {
    console.error("[joinGroupTripByCode] failed:", err);
    return { ok: false, error: "Could not join the trip." };
  }
}

export async function leaveGroupTrip(groupTripId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  const me = session.user.id;

  try {
    const [membership] = await db
      .select({ role: groupTripMembers.role })
      .from(groupTripMembers)
      .where(and(eq(groupTripMembers.groupTripId, groupTripId), eq(groupTripMembers.userId, me)))
      .limit(1);
    if (!membership) return { ok: false, error: "You're not part of this trip." };
    if (membership.role === "admin") return { ok: false, error: "The trip admin can't leave their own trip." };

    await db.delete(groupTripMembers).where(and(eq(groupTripMembers.groupTripId, groupTripId), eq(groupTripMembers.userId, me)));
    revalidatePath("/group-trip");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not leave the trip." };
  }
}

async function requireMembership(
  groupTripId: string
): Promise<{ ok: true; userId: string; role: "admin" | "member" } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  const [membership] = await db
    .select({ role: groupTripMembers.role })
    .from(groupTripMembers)
    .where(and(eq(groupTripMembers.groupTripId, groupTripId), eq(groupTripMembers.userId, session.user.id)))
    .limit(1);
  if (!membership) return { ok: false, error: "You're not part of this trip." };
  return { ok: true, userId: session.user.id, role: membership.role as "admin" | "member" };
}

export async function suggestPlace(groupTripId: string, placeId: string): Promise<ActionResult> {
  const member = await requireMembership(groupTripId);
  if (!member.ok) return member;

  try {
    // A place can only be suggested once per trip (unique constraint) — a
    // repeat "Add" from someone else is a no-op; they vote on the existing
    // suggestion instead.
    await db.insert(groupTripPlaces).values({ groupTripId, placeId, suggestedByUserId: member.userId }).onConflictDoNothing();
    return { ok: true };
  } catch (err) {
    console.error("[suggestPlace] failed:", err);
    return { ok: false, error: "Could not add that place." };
  }
}

const VOTE_VALUES = ["interested", "mustVisit", "notInterested"] as const;

export async function voteOnSuggestion(
  groupTripPlaceId: string,
  value: (typeof VOTE_VALUES)[number]
): Promise<ActionResult> {
  if (!VOTE_VALUES.includes(value)) return { ok: false, error: "Invalid vote." };
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };

  try {
    const [suggestion] = await db
      .select({ groupTripId: groupTripPlaces.groupTripId })
      .from(groupTripPlaces)
      .where(eq(groupTripPlaces.id, groupTripPlaceId))
      .limit(1);
    if (!suggestion) return { ok: false, error: "Suggestion not found." };
    const member = await requireMembership(suggestion.groupTripId);
    if (!member.ok) return member;

    await db
      .insert(groupTripVotes)
      .values({ groupTripPlaceId, userId: session.user.id, value })
      .onConflictDoUpdate({ target: [groupTripVotes.groupTripPlaceId, groupTripVotes.userId], set: { value } });
    return { ok: true };
  } catch (err) {
    console.error("[voteOnSuggestion] failed:", err);
    return { ok: false, error: "Could not save your vote." };
  }
}

export async function decideSuggestion(
  groupTripPlaceId: string,
  decision: "confirmed" | "rejected"
): Promise<ActionResult> {
  try {
    const [suggestion] = await db
      .select({ groupTripId: groupTripPlaces.groupTripId })
      .from(groupTripPlaces)
      .where(eq(groupTripPlaces.id, groupTripPlaceId))
      .limit(1);
    if (!suggestion) return { ok: false, error: "Suggestion not found." };
    const member = await requireMembership(suggestion.groupTripId);
    if (!member.ok) return member;
    if (member.role !== "admin") return { ok: false, error: "Only the trip admin can decide." };

    await db.update(groupTripPlaces).set({ status: decision }).where(eq(groupTripPlaces.id, groupTripPlaceId));
    return { ok: true };
  } catch (err) {
    console.error("[decideSuggestion] failed:", err);
    return { ok: false, error: "Could not save that decision." };
  }
}

export async function generateItinerary(groupTripId: string): Promise<ActionResult & { itinerary?: GeneratedItinerary }> {
  const member = await requireMembership(groupTripId);
  if (!member.ok) return member;
  if (member.role !== "admin") return { ok: false, error: "Only the trip admin can generate the itinerary." };

  try {
    const [trip] = await db.select().from(groupTrips).where(eq(groupTrips.id, groupTripId)).limit(1);
    if (!trip) return { ok: false, error: "Trip not found." };
    if (!trip.startLatitude || !trip.startLongitude) {
      return { ok: false, error: "This trip has no precise start location — recreate it with a location picked from the map/search." };
    }

    const confirmedRows = await db
      .select({
        placeId: places.id,
        name: places.name,
        category: places.category,
        imageUrl: places.imageUrl,
        entryFeePerPerson: places.entryFeePerPerson,
        idealMinutesAtPlace: places.idealMinutesAtPlace,
        idealHoursAtPlace: places.idealHoursAtPlace,
        latitude: places.latitude,
        longitude: places.longitude,
      })
      .from(groupTripPlaces)
      .innerJoin(places, eq(places.id, groupTripPlaces.placeId))
      .where(and(eq(groupTripPlaces.groupTripId, groupTripId), eq(groupTripPlaces.status, "confirmed")));

    const validPlaces = confirmedRows.filter(
      (p) => p.latitude && p.longitude && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
    );
    if (validPlaces.length === 0) {
      return { ok: false, error: "Confirm at least one place (with real coordinates) before generating an itinerary." };
    }

    const start: LatLng = { lat: Number(trip.startLatitude), lng: Number(trip.startLongitude) };
    const waypoints: LatLng[] = [start, ...validPlaces.map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) }))];

    const tripResult = await fetchTrip({ waypoints, roundtrip: true, fixedFirst: true });

    let orderedPlaces: typeof validPlaces;
    let legs: { distanceKm: number; durationMinutes: number }[];
    let totalDistanceKm: number;
    let totalDurationMinutes: number;
    let geometry: [number, number][] | null;

    if (tripResult) {
      // waypointOrder[0] is always the start (fixedFirst); the rest are
      // indices into `validPlaces` shifted by 1 (waypoints[0] is the start).
      const visitOrder = tripResult.waypointOrder.slice(1).map((i) => i - 1);
      orderedPlaces = visitOrder.map((i) => validPlaces[i]);
      legs = tripResult.legs;
      totalDistanceKm = tripResult.distanceKm;
      totalDurationMinutes = tripResult.durationMinutes;
      geometry = tripResult.geometry;
    } else {
      // OSRM unavailable — fall back to the suggestion order with
      // straight-line legs, the same graceful degradation the solo planner
      // uses when routing is unavailable.
      orderedPlaces = validPlaces;
      let prev = start;
      let distSum = 0;
      legs = orderedPlaces.map((p) => {
        const dest = { lat: Number(p.latitude), lng: Number(p.longitude) };
        const km = haversineKm(prev, dest);
        prev = dest;
        distSum += km;
        return { distanceKm: km, durationMinutes: (km / 40) * 60 };
      });
      distSum += haversineKm(prev, start);
      totalDistanceKm = distSum;
      totalDurationMinutes = (distSum / 40) * 60;
      geometry = null;
    }

    const stops: ItineraryStop[] = orderedPlaces.map((p, i) => ({
      placeId: p.placeId,
      name: p.name,
      category: p.category,
      imageUrl: p.imageUrl,
      entryFeePerPerson: p.entryFeePerPerson,
      idealMinutes: p.idealHoursAtPlace != null ? Math.max(15, Math.round(p.idealHoursAtPlace * 60)) : p.idealMinutesAtPlace ?? 60,
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      arrivalKmFromPrev: legs[i]?.distanceKm ?? 0,
      arrivalMinutesFromPrev: legs[i]?.durationMinutes ?? 0,
    }));

    const days = bucketStopsByDay(stops, trip.days);

    const inBlr = isBengaluru(start);
    const fuelTotal = Math.round(
      travelCostFor("car", trip.vehicle as VehicleKind, totalDistanceKm, trip.travellers, inBlr).cost
    );
    const entryFeesTotal = stops.reduce((sum, s) => sum + s.entryFeePerPerson * trip.travellers, 0);
    const foodTotal = trip.travellers * trip.days * GROUP_FOOD_PER_PERSON_PER_DAY;
    const total = fuelTotal + entryFeesTotal + foodTotal;
    const perPersonCost = Math.round(total / Math.max(1, trip.travellers));

    const itinerary: GeneratedItinerary = {
      days,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalDurationMinutes: Math.round(totalDurationMinutes),
      geometry,
      cost: { fuelTotal, entryFeesTotal, foodTotal, total, perPersonCost },
      generatedAt: new Date().toISOString(),
    };

    await db
      .update(groupTrips)
      .set({ itineraryJson: JSON.stringify(itinerary), status: "finalized" })
      .where(eq(groupTrips.id, groupTripId));

    revalidatePath(`/group-trip/${trip.joinCode}`);
    return { ok: true, itinerary };
  } catch (err) {
    console.error("[generateItinerary] failed:", err);
    return { ok: false, error: "Could not generate the itinerary." };
  }
}
