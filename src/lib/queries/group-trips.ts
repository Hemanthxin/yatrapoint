import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupTrips, groupTripMembers, groupTripPlaces, groupTripVotes, places, users, type GroupTrip } from "@/lib/db/schema";

export async function getGroupTripByJoinCode(joinCode: string): Promise<GroupTrip | null> {
  const [row] = await db.select().from(groupTrips).where(eq(groupTrips.joinCode, joinCode.trim().toUpperCase())).limit(1);
  return row ?? null;
}

export async function getGroupTripById(id: string): Promise<GroupTrip | null> {
  const [row] = await db.select().from(groupTrips).where(eq(groupTrips.id, id)).limit(1);
  return row ?? null;
}

export interface Membership {
  role: "admin" | "member";
  joinedAt: Date;
}

export async function getMembership(groupTripId: string, userId: string): Promise<Membership | null> {
  const [row] = await db
    .select({ role: groupTripMembers.role, joinedAt: groupTripMembers.joinedAt })
    .from(groupTripMembers)
    .where(and(eq(groupTripMembers.groupTripId, groupTripId), eq(groupTripMembers.userId, userId)))
    .limit(1);
  return row ? { role: row.role as "admin" | "member", joinedAt: row.joinedAt } : null;
}

export interface GroupTripMemberRow {
  userId: string;
  name: string | null;
  image: string | null;
  role: "admin" | "member";
  joinedAt: Date;
}

export async function listMembers(groupTripId: string): Promise<GroupTripMemberRow[]> {
  const rows = await db
    .select({
      userId: groupTripMembers.userId,
      name: users.name,
      image: users.image,
      role: groupTripMembers.role,
      joinedAt: groupTripMembers.joinedAt,
    })
    .from(groupTripMembers)
    .innerJoin(users, eq(users.id, groupTripMembers.userId))
    .where(eq(groupTripMembers.groupTripId, groupTripId))
    .orderBy(groupTripMembers.joinedAt);
  return rows.map((r) => ({ ...r, role: r.role as "admin" | "member" }));
}

// Trips the traveller either created or joined, newest first — for the
// /group-trip landing list.
export async function listMyGroupTrips(userId: string): Promise<GroupTrip[]> {
  const rows = await db
    .select({ trip: groupTrips })
    .from(groupTripMembers)
    .innerJoin(groupTrips, eq(groupTrips.id, groupTripMembers.groupTripId))
    .where(eq(groupTripMembers.userId, userId))
    .orderBy(desc(groupTrips.createdAt));
  return rows.map((r) => r.trip);
}

export interface SuggestionWithVotes {
  id: string;
  status: "suggested" | "confirmed" | "rejected";
  suggestedByUserId: string;
  suggestedByName: string | null;
  place: {
    id: string;
    name: string;
    category: string;
    imageUrl: string | null;
    shortDescription: string;
    entryFeePerPerson: number;
    googleRating: number | null;
    latitude: string | null;
    longitude: string | null;
    idealMinutesAtPlace: number | null;
    idealHoursAtPlace: number | null;
  };
  votes: { interested: number; mustVisit: number; notInterested: number };
  myVote: "interested" | "mustVisit" | "notInterested" | null;
}

// One query for the suggestion list + place details + vote tally + the
// caller's own vote — exactly the shape the Vote/Decide tabs need. Vote
// counts are aggregated in a lateral-ish subquery-free way: pull every vote
// row for the trip's suggestions in one go and tally in JS, since a group
// trip's suggestion list is always small (tens of rows, not thousands).
export async function listSuggestionsWithVotes(groupTripId: string, currentUserId: string): Promise<SuggestionWithVotes[]> {
  const suggestionRows = await db
    .select({
      id: groupTripPlaces.id,
      status: groupTripPlaces.status,
      suggestedByUserId: groupTripPlaces.suggestedByUserId,
      suggestedByName: users.name,
      placeId: places.id,
      name: places.name,
      category: places.category,
      imageUrl: places.imageUrl,
      shortDescription: places.shortDescription,
      entryFeePerPerson: places.entryFeePerPerson,
      googleRating: places.googleRating,
      latitude: places.latitude,
      longitude: places.longitude,
      idealMinutesAtPlace: places.idealMinutesAtPlace,
      idealHoursAtPlace: places.idealHoursAtPlace,
    })
    .from(groupTripPlaces)
    .innerJoin(places, eq(places.id, groupTripPlaces.placeId))
    .innerJoin(users, eq(users.id, groupTripPlaces.suggestedByUserId))
    .where(eq(groupTripPlaces.groupTripId, groupTripId))
    .orderBy(desc(groupTripPlaces.createdAt));

  if (suggestionRows.length === 0) return [];

  const suggestionIds = suggestionRows.map((r) => r.id);
  const voteRows = await db
    .select({ groupTripPlaceId: groupTripVotes.groupTripPlaceId, userId: groupTripVotes.userId, value: groupTripVotes.value })
    .from(groupTripVotes)
    .where(inArray(groupTripVotes.groupTripPlaceId, suggestionIds));

  const tallyBySuggestion = new Map<string, { interested: number; mustVisit: number; notInterested: number }>();
  const myVoteBySuggestion = new Map<string, string>();
  for (const v of voteRows) {
    const tally = tallyBySuggestion.get(v.groupTripPlaceId) ?? { interested: 0, mustVisit: 0, notInterested: 0 };
    if (v.value === "interested") tally.interested += 1;
    else if (v.value === "mustVisit") tally.mustVisit += 1;
    else if (v.value === "notInterested") tally.notInterested += 1;
    tallyBySuggestion.set(v.groupTripPlaceId, tally);
    if (v.userId === currentUserId) myVoteBySuggestion.set(v.groupTripPlaceId, v.value);
  }

  return suggestionRows.map((r) => ({
    id: r.id,
    status: r.status as "suggested" | "confirmed" | "rejected",
    suggestedByUserId: r.suggestedByUserId,
    suggestedByName: r.suggestedByName,
    place: {
      id: r.placeId,
      name: r.name,
      category: r.category,
      imageUrl: r.imageUrl,
      shortDescription: r.shortDescription,
      entryFeePerPerson: r.entryFeePerPerson,
      googleRating: r.googleRating,
      latitude: r.latitude,
      longitude: r.longitude,
      idealMinutesAtPlace: r.idealMinutesAtPlace,
      idealHoursAtPlace: r.idealHoursAtPlace,
    },
    votes: tallyBySuggestion.get(r.id) ?? { interested: 0, mustVisit: 0, notInterested: 0 },
    myVote: (myVoteBySuggestion.get(r.id) as SuggestionWithVotes["myVote"]) ?? null,
  }));
}

export async function countMembers(groupTripId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupTripMembers)
    .where(eq(groupTripMembers.groupTripId, groupTripId));
  return row?.count ?? 0;
}
