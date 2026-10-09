"use server";

import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { placeReviews } from "@/lib/db/schema";
import { isAdminSession } from "@/lib/admin";
import { ensureReviewsTable } from "@/lib/db/ensure-reviews";

export interface ReviewResult {
  ok: boolean;
  error?: string;
}

const MAX_BODY = 1000;

// Add — or edit, if this user already reviewed the place. One review per user
// per place is enforced by a unique index, so this is a single upsert.
export async function saveReview(
  placeId: string,
  rating: number,
  body: string
): Promise<ReviewResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Please sign in to write a review." };

  if (typeof placeId !== "string" || !placeId || placeId.length > 100) {
    return { ok: false, error: "Unknown place." };
  }
  const stars = Math.round(Number(rating));
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return { ok: false, error: "Pick a star rating from 1 to 5." };
  }
  const text = String(body ?? "").trim().replace(/\n{3,}/g, "\n\n");
  if (text.length > MAX_BODY) {
    return { ok: false, error: `Keep your review under ${MAX_BODY} characters.` };
  }

  await ensureReviewsTable();
  await db
    .insert(placeReviews)
    .values({ placeId, userId, rating: stars, body: text })
    .onConflictDoUpdate({
      target: [placeReviews.placeId, placeReviews.userId],
      set: { rating: stars, body: text, updatedAt: sql`now()` },
    });

  return { ok: true };
}

// Delete a review. Users can delete their own; an admin can remove any.
export async function deleteReview(reviewId: string): Promise<ReviewResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Please sign in." };

  await ensureReviewsTable();
  const where = isAdminSession(session?.user as { email?: string | null; role?: string | null })
    ? eq(placeReviews.id, reviewId)
    : and(eq(placeReviews.id, reviewId), eq(placeReviews.userId, userId));
  const gone = await db.delete(placeReviews).where(where).returning({ id: placeReviews.id });
  if (gone.length === 0) return { ok: false, error: "Review not found." };

  return { ok: true };
}
