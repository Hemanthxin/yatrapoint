/**
 * Seed real food & shopping places into the catalogue from OpenStreetMap.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Food and Shopping tabs on a place asked Overpass live, on every request.
 * That never worked outside Bengaluru, for two reasons:
 *
 *   1. The catalogue itself has no food/shopping rows outside Bengaluru — the
 *      nearest seeded restaurant to Mysore Palace is 98 km away.
 *   2. The public Overpass mirrors are not dependable enough to sit in a page
 *      render. Measured over one afternoon: overpass-api.de answers a
 *      single-clause query in ~800ms but times out on a six-clause one and
 *      starts returning 429 after a handful of calls; kumi and private.coffee
 *      return 500/502; maps.mail.ru takes 12s or 504s.
 *
 * So we fetch once, slowly and politely, into our own table. The page then
 * answers from Postgres, which is fast and always works.
 *
 * HOW IT WORKS
 * ------------
 * Querying once per anchor place would mean 1270 queries with heavy overlap —
 * sixteen Mysuru attractions all want the same restaurants. Instead the anchors
 * are snapped to a coarse geographic grid and we issue ONE query per occupied
 * cell, which typically cuts the request count by more than half. Read-time
 * matching is done by distance in SQL, so it is unaffected by the grid.
 *
 * The run is RESUMABLE: every finished cell is appended to a progress file, so
 * an interrupted run (or a mirror going down for an hour) picks up where it
 * stopped rather than starting over.
 *
 *   npx tsx scripts/seed-nearby-poi.ts            # dry run, prints the plan
 *   npx tsx scripts/seed-nearby-poi.ts --write    # actually fetch and insert
 *   npx tsx scripts/seed-nearby-poi.ts --write --limit 20   # first 20 cells
 */
import { loadEnvConfig } from "@next/env";
import fs from "node:fs";
import path from "node:path";

loadEnvConfig(process.cwd());

const WRITE = process.argv.includes("--write");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i > -1 ? Number(process.argv[i + 1]) : Infinity;
})();

// Grid cell size in degrees. At Indian latitudes 0.08° is ~8.9 km north-south
// and ~8.7 km east-west, so a 6 km query radius from the cell centre covers
// every corner of the cell (half-diagonal ~6.2 km) with a little overlap.
const CELL_DEG = 0.08;
const RADIUS_M = 6000;

// Pacing. overpass-api.de gives an IP two execution slots and starts answering
// 429 (then 504) when you burst past them — which is exactly what happened on
// the first attempt at this. Six seconds between requests keeps a single
// crawler comfortably inside the fair-use policy, at the cost of the whole run
// taking hours. It is resumable, so that is a fine trade.
const DELAY_MS = 6000;
const BACKOFF_MS = 120_000;

const PROGRESS_FILE = path.join(process.cwd(), ".seed-nearby-poi.progress");

const FOOD = ["restaurant", "cafe", "fast_food"] as const;
const SHOPPING = ["mall", "marketplace"] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);

function cellKey(lat: number, lng: number): string {
  return `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`;
}

function cellCentre(key: string): { lat: number; lng: number } {
  const [a, b] = key.split(":").map(Number);
  return { lat: (a + 0.5) * CELL_DEG, lng: (b + 0.5) * CELL_DEG };
}

function loadProgress(): Set<string> {
  try {
    return new Set(
      fs.readFileSync(PROGRESS_FILE, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const { places } = await import("../src/lib/db/schema");
  const { fetchOverpassPlaces } = await import("../src/lib/overpass");

  // 1. Anchors — every catalogue place a traveller can open, with coordinates.
  const anchorRes = await db.execute(sql`
    SELECT latitude, longitude, coalesce(city, district, state) AS locality
    FROM places
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      AND kinds NOT LIKE '%city%'
      AND is_hidden = false
  `);
  const anchors = (anchorRes.rows ?? anchorRes) as Array<{
    latitude: string;
    longitude: string;
    locality: string | null;
  }>;

  // 2. Collapse them onto the grid. The locality of the first anchor in a cell
  //    labels every POI we find there, so a seeded restaurant still says
  //    "Mysuru" rather than nothing.
  const cells = new Map<string, string | null>();
  for (const a of anchors) {
    const lat = Number(a.latitude);
    const lng = Number(a.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = cellKey(lat, lng);
    if (!cells.has(key)) cells.set(key, a.locality);
  }

  const done = loadProgress();
  const todo = [...cells.keys()].filter((k) => !done.has(k)).slice(0, LIMIT);

  console.log(`anchors: ${anchors.length}`);
  console.log(`grid cells occupied: ${cells.size} (cell ${CELL_DEG}°, radius ${RADIUS_M}m)`);
  console.log(`already done: ${done.size}   to fetch: ${todo.length}`);
  console.log(`estimated wall time: ~${Math.round((todo.length * (DELAY_MS + 6000)) / 60000)} min`);

  if (!WRITE) {
    console.log("\nDRY RUN — pass --write to fetch and insert.");
    process.exit(0);
  }

  // 3. Existing slugs, so a re-run never duplicates a row.
  const existingRes = await db.execute(sql`SELECT slug FROM places`);
  const existing = new Set(
    ((existingRes.rows ?? existingRes) as Array<{ slug: string }>).map((r) => r.slug)
  );

  let inserted = 0;
  let cellNo = 0;

  for (const key of todo) {
    cellNo += 1;
    const centre = cellCentre(key);
    const locality = cells.get(key) ?? null;
    const label = `[${cellNo}/${todo.length}] ${centre.lat.toFixed(3)},${centre.lng.toFixed(3)}`;

    // ONE CATEGORY PER REQUEST. Each category expands to two clauses (node and
    // way), so asking for all three food categories at once builds the
    // six-clause query that overpass-api.de reliably times out on, while the
    // single-category form comes back in under a second. Five small requests
    // beat two that fail.
    const batches: Array<{ cats: readonly string[]; kind: "food" | "shopping" }> = [
      ...FOOD.map((c) => ({ cats: [c] as readonly string[], kind: "food" as const })),
      ...SHOPPING.map((c) => ({ cats: [c] as readonly string[], kind: "shopping" as const })),
    ];

    const found: Array<{
      name: string;
      category: string;
      lat: number;
      lng: number;
      imageUrl: string | null;
      cuisine: string | null;
      osmId: string;
    }> = [];

    // A cell only counts as done when Overpass actually ANSWERED. Marking a
    // cell done after every mirror refused would bake the failure in: the
    // resume would skip it forever and that patch of the map would stay empty.
    let answered = false;

    for (const b of batches) {
      let attempt = 0;
      for (;;) {
        attempt += 1;
        try {
          const res = await fetchOverpassPlaces({
            centre,
            categories: [...b.cats] as never,
            radius: RADIUS_M,
            limit: 120,
            cap: 120,
          });
          for (const p of res) {
            found.push({
              name: p.name,
              category: p.category,
              lat: p.lat,
              lng: p.lng,
              imageUrl: p.imageUrl ?? null,
              cuisine: p.tags.cuisine ?? null,
              osmId: p.osmId,
            });
          }
          answered = true;
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (attempt >= 3) {
            console.log(`${label} ${b.kind}: giving up — ${msg.slice(0, 90)}`);
            break;
          }
          console.log(`${label} ${b.kind}: retry ${attempt} after backoff — ${msg.slice(0, 70)}`);
          await sleep(BACKOFF_MS);
        }
      }
      await sleep(DELAY_MS);
    }

    // 4. Insert what is new. The slug carries the OSM id, which is what makes
    //    this idempotent across runs and across overlapping cells.
    const rows = [];
    for (const f of found) {
      const slug = `${slugify(f.name)}-${f.osmId.replace("/", "-")}`.slice(0, 158);
      if (existing.has(slug)) continue;
      existing.add(slug);
      rows.push({
        slug,
        name: f.name.slice(0, 220),
        kinds: "city",
        category: f.category,
        cityKind: f.category,
        city: locality,
        description: `${f.name} — ${f.category.replace(/_/g, " ")}${
          locality ? ` in ${locality}` : ""
        }. Mapped in OpenStreetMap.`,
        shortDescription: `${f.name} — ${f.category.replace(/_/g, " ")}`.slice(0, 240),
        imageUrl: f.imageUrl,
        latitude: String(f.lat),
        longitude: String(f.lng),
        tags: f.cuisine,
        popularity: 30,
      });
    }

    if (rows.length) {
      // Chunked: a single insert of a few hundred rows trips the Neon
      // serverless driver's socket limit.
      for (let i = 0; i < rows.length; i += 100) {
        await db.insert(places).values(rows.slice(i, i + 100)).onConflictDoNothing();
      }
      inserted += rows.length;
    }

    console.log(
      `${label} ${locality ?? "?"} — ${answered ? `found ${found.length}, inserted ${rows.length} (total ${inserted})` : "NO MIRROR ANSWERED — will retry on the next run"}`
    );
    fs.appendFileSync(PROGRESS_FILE, key + "\n");
  }

  console.log(`\nDone. ${inserted} new food/shopping places inserted.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
