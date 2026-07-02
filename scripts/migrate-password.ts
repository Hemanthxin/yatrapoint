import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Idempotent migration for email/phone + password login.
// Run: npm run db:migrate:password
async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text`);
  console.log("users.password_hash ready.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
