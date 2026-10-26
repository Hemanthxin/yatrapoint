import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Creates the user_consents table if it is missing. Idempotent and memoised, like
// ensure-reviews. It is an append-only log: every grant or withdrawal is a new
// row, and the newest row per (user, kind) is the current state. Keeping the
// history is what lets us show when, and to which version, a person agreed.
let ready: Promise<void> | null = null;

export function ensureConsentsTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS "user_consents" (
        "id" text PRIMARY KEY,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "kind" varchar(20) NOT NULL,
        "version" varchar(20) NOT NULL,
        "granted" boolean NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "user_consents_user_kind_idx" ON "user_consents" ("user_id", "kind", "created_at")`
      );
    })().catch((err) => {
      ready = null; // let the next request retry
      throw err;
    });
  }
  return ready;
}
