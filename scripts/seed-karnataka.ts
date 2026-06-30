import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Seeds ONLY the comprehensive Karnataka destinations catalogue (all 31
// districts). Idempotent: existing rows are updated by slug. Run with:
//   npm run db:seed:karnataka
async function run() {
  const { db } = await import("../src/lib/db");
  const { destinations } = await import("../src/lib/db/schema");
  const { karnatakaDestinations } = await import("../src/lib/db/seed-karnataka");

  console.log(`Seeding ${karnatakaDestinations.length} Karnataka destinations...`);
  for (const d of karnatakaDestinations) {
    await db
      .insert(destinations)
      .values(d)
      .onConflictDoUpdate({
        target: destinations.slug,
        set: {
          name: d.name,
          state: d.state,
          district: d.district,
          category: d.category,
          placeType: d.placeType,
          description: d.description,
          shortDescription: d.shortDescription,
          imageUrl: d.imageUrl,
          openingTimings: d.openingTimings,
          entryFees: d.entryFees,
          budgetPerDay: d.budgetPerDay,
          recommendedDays: d.recommendedDays,
          bestMonths: d.bestMonths,
          isHidden: d.isHidden,
          popularity: d.popularity,
          latitude: d.latitude,
          longitude: d.longitude,
        },
      });
    process.stdout.write(".");
  }
  console.log();

  const rows = await db.select({ id: destinations.id }).from(destinations);
  console.log(`Done. Total destinations in DB: ${rows.length}.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
