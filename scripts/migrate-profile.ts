import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Idempotent, non-interactive migration for the Instagram-style profile fields
// (users.username, users.bio). Safe to re-run. Run with: npm run db:migrate:profile
async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" varchar(40)`);
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" varchar(300)`);
  // Case-insensitive uniqueness for handles, ignoring NULLs.
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "users_username_lower_uq" ON "users" (lower("username")) WHERE "username" IS NOT NULL`
  );

  console.log("Profile columns ready: users.username, users.bio (+ unique handle index).");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
