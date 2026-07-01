import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Idempotent migration for the admin headlines/news ticker.
// Run: npm run db:migrate:announcements
async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "announcements" (
    "id" text PRIMARY KEY,
    "message" varchar(300) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`);
  console.log("announcements table ready.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
