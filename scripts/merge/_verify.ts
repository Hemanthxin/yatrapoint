import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function run() {
  const { db } = await import("../../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const q = async (s: ReturnType<typeof sql>) => {
    const r = await db.execute(s);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((r as any).rows ?? r) as Record<string, unknown>[];
  };

  console.log("=== totals ===");
  console.log(await q(sql`SELECT
      (SELECT count(*)::int FROM places) AS places,
      (SELECT count(*)::int FROM destinations) AS destinations,
      (SELECT count(*)::int FROM nearby_destinations) AS day_trips,
      (SELECT count(*)::int FROM city_places) AS city_places`));

  console.log("\n=== kinds ===");
  for (const r of await q(sql`SELECT kinds, count(*)::int AS n FROM places GROUP BY kinds ORDER BY n DESC`)) {
    console.log(` ${String(r.kinds).padEnd(24)} ${r.n}`);
  }

  console.log("\n=== gallery images ===");
  console.log(await q(sql`SELECT place_type, count(*)::int AS n FROM place_images GROUP BY place_type`));
  const orphan = await q(sql`
    SELECT count(*)::int AS n FROM place_images pi
    LEFT JOIN places p ON p.id = pi.place_id WHERE p.id IS NULL`);
  console.log("gallery rows not matching any place:", orphan[0].n);

  console.log("\n=== the two places from the report ===");
  for (const probe of ["Madhugiri", "Kurudumale"]) {
    const rows = await q(sql`
      SELECT p.name, p.kinds, p.slug, p.legacy_slugs, p.image_url IS NOT NULL AS has_image,
             (SELECT count(*)::int FROM place_images i WHERE i.place_id = p.id) AS gallery
      FROM places p WHERE p.name ILIKE ${"%" + probe + "%"}`);
    console.log(`\n  ${probe}: ${rows.length} row(s)`);
    for (const r of rows) {
      console.log(`    "${r.name}"  kinds=${r.kinds}  gallery=${r.gallery}  image=${r.has_image}`);
      console.log(`      slug=${r.slug}  legacy=${r.legacy_slugs ?? "none"}`);
    }
  }

  console.log("\n=== integrity ===");
  const dupSlug = await q(sql`SELECT count(*)::int AS n FROM (SELECT slug FROM places GROUP BY slug HAVING count(*) > 1) x`);
  console.log("duplicate slugs:", dupSlug[0].n);
  const noCoords = await q(sql`SELECT count(*)::int AS n FROM places WHERE latitude IS NULL OR longitude IS NULL`);
  console.log("places without coordinates:", noCoords[0].n);
  const badKinds = await q(sql`SELECT count(*)::int AS n FROM places WHERE kinds IS NULL OR kinds = ''`);
  console.log("places with no kind:", badKinds[0].n);

  // Every favourite / saved trip item must still resolve to a place.
  const favLost = await q(sql`
    SELECT count(*)::int AS n FROM favorites f
    LEFT JOIN places p ON p.id = f.destination_id WHERE p.id IS NULL`);
  const tripLost = await q(sql`
    SELECT count(*)::int AS n FROM trip_plan_items t
    LEFT JOIN places p ON p.id = t.destination_id WHERE p.id IS NULL`);
  console.log("favourites pointing at a missing place:", favLost[0].n);
  console.log("trip-plan items pointing at a missing place:", tripLost[0].n);

  console.log("\n=== galleries rescued (place has photos it could not show before) ===");
  const rescued = await q(sql`
    SELECT p.name, p.kinds, count(i.id)::int AS gallery
    FROM places p JOIN place_images i ON i.place_id = p.id
    WHERE p.kinds LIKE '%,%'
    GROUP BY p.id, p.name, p.kinds ORDER BY p.name LIMIT 40`);
  for (const r of rescued) console.log(`  ${String(r.name).padEnd(50)} ${r.gallery} photos  [${r.kinds}]`);
  console.log(`  (${rescued.length} multi-kind places carrying a gallery)`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
