import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Idempotent migration for place reviews. The app also creates this table on
// first use, so running it is optional.
// Run: npm run db:migrate:reviews
async function run() {
  const { ensureReviewsTable } = await import("../src/lib/db/ensure-reviews");
  await ensureReviewsTable();
  console.log("place_reviews table ready.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
