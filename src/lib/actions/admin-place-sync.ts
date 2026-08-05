"use server";

import { eq, sql as rawSql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { destinations, cityPlaces, nearbyDestinations } from "@/lib/db/schema";
import { isAdminSession } from "@/lib/admin";
import { findGooglePlaceId, fetchGooglePlaceStatus } from "@/lib/google-places";

export interface SyncBatchResult {
  ok: boolean;
  error?: string;
  synced: number;
  failed: number;
  details: string[];
}

export interface SyncCoverage {
  destinations: { total: number; synced: number };
  cityPlaces: { total: number; synced: number };
  nearbyDestinations: { total: number; synced: number };
}

async function requireAdminOrDeny(): Promise<{ error: string } | null> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return { error: "Not authorized." };
  return null;
}

export async function fetchSyncCoverage(): Promise<SyncCoverage | null> {
  const denied = await requireAdminOrDeny();
  if (denied) return null;

  const [dest, city, nearby] = await Promise.all([
    db
      .select({ total: rawSql<number>`count(*)`, synced: rawSql<number>`count(${destinations.googleSyncedAt})` })
      .from(destinations),
    db
      .select({ total: rawSql<number>`count(*)`, synced: rawSql<number>`count(${cityPlaces.googleSyncedAt})` })
      .from(cityPlaces),
    db
      .select({ total: rawSql<number>`count(*)`, synced: rawSql<number>`count(${nearbyDestinations.googleSyncedAt})` })
      .from(nearbyDestinations),
  ]);
  return {
    destinations: { total: Number(dest[0]?.total ?? 0), synced: Number(dest[0]?.synced ?? 0) },
    cityPlaces: { total: Number(city[0]?.total ?? 0), synced: Number(city[0]?.synced ?? 0) },
    nearbyDestinations: { total: Number(nearby[0]?.total ?? 0), synced: Number(nearby[0]?.synced ?? 0) },
  };
}

type PlaceRow = { id: string; name: string; lat: number; lng: number; googlePlaceId: string | null };

// One place's sync — resolve a Google Place ID if missing, then fetch
// rating/hours. Always stamps googleSyncedAt (even on failure) so a
// permanently-unmatchable place doesn't get retried every single batch.
async function syncOne(row: PlaceRow): Promise<{ googlePlaceId: string | null; rating: number | null; ratingCount: number | null; weeklyHours: string | null; ok: boolean }> {
  let placeId = row.googlePlaceId;
  if (!placeId) placeId = await findGooglePlaceId(row.name, row.lat, row.lng);
  if (!placeId) return { googlePlaceId: null, rating: null, ratingCount: null, weeklyHours: null, ok: false };

  const status = await fetchGooglePlaceStatus(placeId);
  if (!status) return { googlePlaceId: placeId, rating: null, ratingCount: null, weeklyHours: null, ok: false };

  return {
    googlePlaceId: placeId,
    rating: status.rating,
    ratingCount: status.ratingCount,
    weeklyHours: status.weeklyHours ? JSON.stringify(status.weeklyHours) : null,
    ok: true,
  };
}

// Selects up to `limit` places across all 3 catalogues (unsynced first,
// then oldest-synced), split roughly evenly so no single catalogue starves
// a shared batch, and syncs each. Admin-triggered only — every call here
// is a real, billed Google API request, so there's no cron/auto-run.
export async function syncNextPlacesBatch(limit = 20): Promise<SyncBatchResult> {
  const denied = await requireAdminOrDeny();
  if (denied) return { ok: false, error: denied.error, synced: 0, failed: 0, details: [] };

  const perTable = Math.max(1, Math.ceil(limit / 3));
  const details: string[] = [];
  let synced = 0;
  let failed = 0;

  const destRows = await db
    .select({ id: destinations.id, name: destinations.name, lat: destinations.latitude, lng: destinations.longitude, googlePlaceId: destinations.googlePlaceId })
    .from(destinations)
    .orderBy(rawSql`${destinations.googleSyncedAt} asc nulls first`)
    .limit(perTable);
  const cityRows = await db
    .select({ id: cityPlaces.id, name: cityPlaces.name, lat: cityPlaces.latitude, lng: cityPlaces.longitude, googlePlaceId: cityPlaces.googlePlaceId })
    .from(cityPlaces)
    .orderBy(rawSql`${cityPlaces.googleSyncedAt} asc nulls first`)
    .limit(perTable);
  const nearbyRows = await db
    .select({ id: nearbyDestinations.id, name: nearbyDestinations.name, lat: nearbyDestinations.latitude, lng: nearbyDestinations.longitude, googlePlaceId: nearbyDestinations.googlePlaceId })
    .from(nearbyDestinations)
    .orderBy(rawSql`${nearbyDestinations.googleSyncedAt} asc nulls first`)
    .limit(perTable);

  for (const row of destRows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const result = await syncOne({ ...row, lat, lng });
    await db
      .update(destinations)
      .set({
        googlePlaceId: result.googlePlaceId,
        googleRating: result.rating,
        googleRatingCount: result.ratingCount,
        googleWeeklyHours: result.weeklyHours,
        googleSyncedAt: new Date(),
      })
      .where(eq(destinations.id, row.id));
    if (result.ok) synced++;
    else failed++;
    details.push(`${result.ok ? "✓" : "✗"} [destination] ${row.name}`);
  }

  for (const row of cityRows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const result = await syncOne({ ...row, lat, lng });
    await db
      .update(cityPlaces)
      .set({
        googlePlaceId: result.googlePlaceId,
        googleRating: result.rating,
        googleRatingCount: result.ratingCount,
        googleWeeklyHours: result.weeklyHours,
        googleSyncedAt: new Date(),
      })
      .where(eq(cityPlaces.id, row.id));
    if (result.ok) synced++;
    else failed++;
    details.push(`${result.ok ? "✓" : "✗"} [city place] ${row.name}`);
  }

  for (const row of nearbyRows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const result = await syncOne({ ...row, lat, lng });
    await db
      .update(nearbyDestinations)
      .set({
        googlePlaceId: result.googlePlaceId,
        googleRating: result.rating,
        googleRatingCount: result.ratingCount,
        googleWeeklyHours: result.weeklyHours,
        googleSyncedAt: new Date(),
      })
      .where(eq(nearbyDestinations.id, row.id));
    if (result.ok) synced++;
    else failed++;
    details.push(`${result.ok ? "✓" : "✗"} [nearby trip] ${row.name}`);
  }

  return { ok: true, synced, failed, details };
}
