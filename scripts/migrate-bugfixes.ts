import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Idempotent migration for the bug-report fixes.
// Run: npm run db:migrate:bugfixes
//
//  • google_business_status on all three place tables — lets the app hide
//    permanently-closed places (BUG-01). Populated by the admin Google sync.
//  • festival_suggestions — community-submitted local festivals & events,
//    held for admin approval (BUG-10).
async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  for (const table of ["destinations", "city_places", "nearby_destinations"]) {
    await db.execute(
      sql.raw(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "google_business_status" varchar(24)`
      )
    );
    console.log(`${table}.google_business_status ready.`);
  }

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "festival_suggestions" (
    "id" text PRIMARY KEY,
    "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
    "submitted_by_name" varchar(120),
    "name" varchar(140) NOT NULL,
    "hub" varchar(160),
    "date_iso" varchar(10),
    "date_label" varchar(80),
    "significance" text,
    "image_url" text,
    "status" varchar(20) DEFAULT 'pending' NOT NULL,
    "review_note" varchar(300),
    "reviewed_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "festival_suggestions_status_created_idx" ON "festival_suggestions" ("status", "created_at")`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "festival_suggestions_user_idx" ON "festival_suggestions" ("user_id")`
  );
  console.log("festival_suggestions table ready.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
