import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Creates the place_reviews table if it is missing. Idempotent, and memoised so
// it costs one round-trip per server instance. This is what lets reviews work
// on a deploy where `npm run db:migrate:reviews` was never run; the script just
// calls the same function.
let ready: Promise<void> | null = null;

export function ensureReviewsTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS "place_reviews" (
        "id" text PRIMARY KEY,
        "place_id" text NOT NULL,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "rating" integer NOT NULL,
        "body" varchar(1000) DEFAULT '' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "place_reviews_place_user_uq" UNIQUE ("place_id", "user_id")
      )`);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "place_reviews_place_idx" ON "place_reviews" ("place_id", "created_at")`
      );
    })().catch((err) => {
      ready = null; // let the next request retry
      throw err;
    });
  }
  return ready;
}
