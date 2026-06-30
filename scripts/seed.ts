import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function run() {
  const { db } = await import("../src/lib/db");
  const { destinations, nearbyDestinations, cityPlaces } = await import(
    "../src/lib/db/schema"
  );
  const { seedDestinations } = await import("../src/lib/db/seed-data");
  const { karnatakaDestinations } = await import("../src/lib/db/seed-karnataka");
  const { bangaloreOneDayTrips } = await import("../src/lib/db/seed-nearby");
  const { bangaloreOneDayTripsExtra } = await import("../src/lib/db/seed-nearby-extra");
  const { bangaloreCityPlaces } = await import("../src/lib/db/seed-city");
  const { bangaloreCityPlacesExtra } = await import("../src/lib/db/seed-city-extra");
  const { bangaloreCityPlacesExtra2 } = await import("../src/lib/db/seed-city-extra2");

  // Dedupe helper — keep the first row per slug so overlapping batches can't
  // insert the same place twice.
  const bySlug = <T extends { slug: string }>(rows: T[]): T[] => {
    const seen = new Set<string>();
    return rows.filter((r) => (seen.has(r.slug) ? false : (seen.add(r.slug), true)));
  };

  // Curated pan-India picks + the full Karnataka catalogue (all 31 districts).
  const allDestinations = bySlug([...seedDestinations, ...karnatakaDestinations]);

  console.log(`Seeding ${allDestinations.length} destinations...`);
  for (const d of allDestinations) {
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

  const allNearby = bySlug([...bangaloreOneDayTrips, ...bangaloreOneDayTripsExtra]);
  console.log(`Seeding ${allNearby.length} nearby destinations...`);
  for (const n of allNearby) {
    await db
      .insert(nearbyDestinations)
      .values(n)
      .onConflictDoUpdate({
        target: nearbyDestinations.slug,
        set: {
          name: n.name,
          baseCity: n.baseCity,
          category: n.category,
          description: n.description,
          shortDescription: n.shortDescription,
          imageUrl: n.imageUrl,
          distanceKm: n.distanceKm,
          drivingMinutes: n.drivingMinutes,
          entryFeePerPerson: n.entryFeePerPerson,
          idealHoursAtPlace: n.idealHoursAtPlace,
          bestStartTime: n.bestStartTime,
          highlights: n.highlights,
          latitude: n.latitude,
          longitude: n.longitude,
          popularity: n.popularity,
        },
      });
    process.stdout.write(".");
  }
  console.log();

  const allCity = bySlug([
    ...bangaloreCityPlaces,
    ...bangaloreCityPlacesExtra,
    ...bangaloreCityPlacesExtra2,
  ]);
  console.log(`Seeding ${allCity.length} city places...`);
  for (const c of allCity) {
    await db
      .insert(cityPlaces)
      .values(c)
      .onConflictDoUpdate({
        target: cityPlaces.slug,
        set: {
          name: c.name,
          city: c.city,
          kind: c.kind,
          category: c.category,
          area: c.area,
          description: c.description,
          shortDescription: c.shortDescription,
          imageUrl: c.imageUrl,
          entryFeePerPerson: c.entryFeePerPerson,
          avgCostForTwo: c.avgCostForTwo,
          idealMinutesAtPlace: c.idealMinutesAtPlace,
          openTime: c.openTime,
          closeTime: c.closeTime,
          openDays: c.openDays,
          tags: c.tags,
          latitude: c.latitude,
          longitude: c.longitude,
          googlePlaceId: c.googlePlaceId,
          popularity: c.popularity,
        },
      });
    process.stdout.write(".");
  }
  console.log();

  const [dRows, nRows, cRows] = await Promise.all([
    db.select({ id: destinations.id }).from(destinations),
    db.select({ id: nearbyDestinations.id }).from(nearbyDestinations),
    db.select({ id: cityPlaces.id }).from(cityPlaces),
  ]);
  console.log(
    `Done. destinations=${dRows.length}, nearby_destinations=${nRows.length}, city_places=${cRows.length}.`
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
