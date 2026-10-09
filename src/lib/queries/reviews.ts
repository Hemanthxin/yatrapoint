import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureReviewsTable } from "@/lib/db/ensure-reviews";
import { placeReviews, users } from "@/lib/db/schema";

export interface ReviewItem {
  id: string;
  userId: string;
  authorName: string;
  authorImage: string | null;
  rating: number;
  body: string;
  createdAt: string;
  edited: boolean;
}

export interface PlaceReviewSummary {
  reviews: ReviewItem[];
  count: number;
  average: number;
  /** counts[0] is 1-star … counts[4] is 5-star */
  counts: number[];
}

const MAX_SHOWN = 200;

// Every review of one place, newest first, with the author's current name and
// photo (read from the users table so a profile change shows on old reviews).
export async function getPlaceReviews(placeId: string): Promise<PlaceReviewSummary> {
  await ensureReviewsTable();
  const rows = await db
    .select({
      id: placeReviews.id,
      userId: placeReviews.userId,
      rating: placeReviews.rating,
      body: placeReviews.body,
      createdAt: placeReviews.createdAt,
      updatedAt: placeReviews.updatedAt,
      name: users.name,
      username: users.username,
      image: users.image,
    })
    .from(placeReviews)
    .leftJoin(users, eq(users.id, placeReviews.userId))
    .where(eq(placeReviews.placeId, placeId))
    .orderBy(desc(placeReviews.createdAt))
    .limit(MAX_SHOWN);

  const counts = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const r of rows) {
    const i = Math.min(5, Math.max(1, r.rating)) - 1;
    counts[i] += 1;
    sum += r.rating;
  }

  return {
    reviews: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      authorName: r.name || r.username || "Traveller",
      authorImage: r.image,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      // updatedAt is set on every save; a gap of more than a minute from
      // createdAt means the review was genuinely edited after posting.
      edited: r.updatedAt.getTime() - r.createdAt.getTime() > 60_000,
    })),
    count: rows.length,
    average: rows.length ? sum / rows.length : 0,
    counts,
  };
}
