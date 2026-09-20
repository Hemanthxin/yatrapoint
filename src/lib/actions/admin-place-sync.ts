"use server";

import { eq, sql as rawSql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
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
  places: { total: number; synced: number };
}

async function requireAdminOrDeny(): Promise<{ error: string } | null> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return { error: "Not authorized." };
  return null;
}

export async function fetchSyncCoverage(): Promise<SyncCoverage | null> {
  const denied = await requireAdminOrDeny();
  if (denied) return null;

  // One count now that every place lives in one table.
  const [row] = await db
    .select({
      total: rawSql<number>`count(*)`,
      synced: rawSql<number>`count(${places.googleSyncedAt})`,
    })
    .from(places);
  return {
    places: { total: Number(row?.total ?? 0), synced: Number(row?.synced ?? 0) },
  };
}

type PlaceRow = { id: string; name: string; lat: number; lng: number; googlePlaceId: string | null };

// One place's sync — resolve a Google Place ID if missing, then fetch
// rating/hours. Always stamps googleSyncedAt (even on failure) so a
// permanently-unmatchable place doesn't get retried every single batch.
async function syncOne(row: PlaceRow): Promise<{ googlePlaceId: string | null; rating: number | null; ratingCount: number | null; weeklyHours: string | null; businessStatus: string | null; ok: boolean }> {
  let placeId = row.googlePlaceId;
  if (!placeId) placeId = await findGooglePlaceId(row.name, row.lat, row.lng);
  if (!placeId) return { googlePlaceId: null, rating: null, ratingCount: null, weeklyHours: null, businessStatus: null, ok: false };

  const status = await fetchGooglePlaceStatus(placeId);
  if (!status) return { googlePlaceId: placeId, rating: null, ratingCount: null, weeklyHours: null, businessStatus: null, ok: false };

  return {
    googlePlaceId: placeId,
    rating: status.rating,
    ratingCount: status.ratingCount,
    weeklyHours: status.weeklyHours ? JSON.stringify(status.weeklyHours) : null,
    businessStatus: status.businessStatus,
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

  const details: string[] = [];
  let synced = 0;
  let failed = 0;

  // One queue now that every place lives in one table. This used to take a
  // third of the batch from each catalogue so none starved; with a single
  // table the oldest-synced-first ordering covers everything fairly on its
  // own, and a place that belonged to two catalogues is no longer synced
  // twice — which was paying Google twice for the same place.
  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      lat: places.latitude,
      lng: places.longitude,
      googlePlaceId: places.googlePlaceId,
      kinds: places.kinds,
    })
    .from(places)
    .orderBy(rawSql`${places.googleSyncedAt} asc nulls first`)
    .limit(limit);

  for (const row of rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const result = await syncOne({ ...row, lat, lng });
    await db
      .update(places)
      .set({
        googlePlaceId: result.googlePlaceId,
        googleRating: result.rating,
        googleRatingCount: result.ratingCount,
        googleWeeklyHours: result.weeklyHours,
        googleBusinessStatus: result.businessStatus,
        googleSyncedAt: new Date(),
      })
      .where(eq(places.id, row.id));
    if (result.ok) synced++;
    else failed++;
    details.push(`${result.ok ? "✓" : "✗"} [${row.kinds}] ${row.name}`);
  }

  return { ok: true, synced, failed, details };
}