/**
 * Fast first-pass geocoding: resolve many place names at once via Overpass.
 *
 * WHY
 * ---
 * scripts/geocode-missing.ts asks Nominatim one place at a time and its usage
 * policy caps that at one request per second, so ~9,000 imported places is
 * roughly seven hours. Overpass will answer a batch of exact-name lookups
 * inside a state boundary in one request: ten names came back in 3.8 seconds
 * in testing. This clears the easy majority in minutes and leaves the awkward
 * remainder — misspelled, renamed, or simply not in OSM under that name — to
 * the slower fuzzy search.
 *
 * AMBIGUITY IS REFUSED, NOT GUESSED
 * ---------------------------------
 * An exact-name lookup across a whole state is not automatically unique:
 * "Thiruvalluvar Statue" returns six different statues scattered across Tamil
 * Nadu. Taking the first would drop a pin in the wrong town, and a wrong
 * coordinate is worse than none — it puts the place on the map somewhere it
 * is not and drags trip routes and distance calculations to that spot. So a
 * name is only accepted when every OSM match for it sits within 2 km of the
 * others (one place mapped as several nodes). Anything genuinely scattered is
 * left for the Nominatim pass, which can use the district to disambiguate.
 *
 *   npx tsx scripts/geocode-bulk-osm.ts --state "Tamil Nadu"           # dry run
 *   npx tsx scripts/geocode-bulk-osm.ts --state "Tamil Nadu" --write
 *   npx tsx scripts/geocode-bulk-osm.ts --all --write
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const WRITE = process.argv.includes("--write");
const ALL = process.argv.includes("--all");
const STATE_ARG = (() => {
  const i = process.argv.indexOf("--state");
  return i > -1 ? process.argv[i + 1] : "";
})();

// ISO 3166-2 codes, which is how OSM tags an Indian state boundary.
const STATE_ISO: Record<string, string> = {
  karnataka: "IN-KA",
  "tamil nadu": "IN-TN",
  kerala: "IN-KL",
  maharashtra: "IN-MH",
  "andhra pradesh": "IN-AP",
  telangana: "IN-TG",
};

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const BATCH = 40;
const DELAY_MS = 5000; // polite spacing between Overpass queries
const USER_AGENT = "Saafera/1.0 (+https://saafera.com; catalogue geocoding)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface OsmEl {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function askOverpass(query: string): Promise<OsmEl[] | null> {
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OsmEl[] };
      if (Array.isArray(json.elements)) return json.elements;
    } catch {
      /* try the next mirror */
    }
  }
  return null;
}

async function geocodeState(state: string): Promise<void> {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  const iso = STATE_ISO[state.toLowerCase()];
  if (!iso) {
    console.log(`${state}: no ISO code registered, skipping`);
    return;
  }

  const res = await db.execute(sql`
    SELECT slug, name FROM places
    WHERE (latitude IS NULL OR longitude IS NULL)
      AND lower(coalesce(state, '')) = ${state.toLowerCase()}
    ORDER BY name
  `);
  const rows = (res.rows ?? res) as Array<{ slug: string; name: string }>;

  console.log(`\n=== ${state}: ${rows.length} without coordinates ===`);
  if (rows.length === 0) return;

  const batches: Array<typeof rows> = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));

  console.log(`${batches.length} Overpass queries of up to ${BATCH} names each`);
  if (!WRITE) {
    console.log("DRY RUN — pass --write to save.");
    return;
  }

  let located = 0;
  let ambiguous = 0;
  let missing = 0;
  let saveFailed = 0;

  for (let b = 0; b < batches.length; b += 1) {
    const batch = batches[b];
    const clauses = batch
      .map((r) => `nwr["name"="${r.name.replace(/["\\]/g, "\\$&")}"](area.a);`)
      .join("");
    const query = `[out:json][timeout:180];area["ISO3166-2"="${iso}"]->.a;(${clauses});out center tags;`;

    const els = await askOverpass(query);
    if (els === null) {
      console.log(`  [batch ${b + 1}/${batches.length}] no mirror answered — skipped`);
      await sleep(DELAY_MS);
      continue;
    }

    // Group every hit by its name.
    const hits = new Map<string, Array<{ lat: number; lng: number }>>();
    for (const e of els) {
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const nm = e.tags?.name;
      if (lat == null || lng == null || !nm) continue;
      const k = key(nm);
      hits.set(k, [...(hits.get(k) ?? []), { lat, lng }]);
    }

    for (const r of batch) {
      const found = hits.get(key(r.name));
      if (!found || found.length === 0) {
        missing += 1;
        continue;
      }

      // Several nodes for one place is fine; several places sharing a name is
      // not. 2 km apart is the line between the two.
      const first = found[0];
      const scattered = found.some((p) => haversineKm(first, p) > 2);
      if (scattered) {
        ambiguous += 1;
        continue;
      }

      try {
        await db.execute(sql`
          UPDATE places
          SET latitude = ${String(first.lat)}, longitude = ${String(first.lng)}
          WHERE slug = ${r.slug}
        `);
        located += 1;
      } catch {
        saveFailed += 1;
      }
    }

    console.log(
      `  [batch ${b + 1}/${batches.length}] located ${located}, ambiguous ${ambiguous}, not in OSM ${missing}`
    );
    await sleep(DELAY_MS);
  }

  console.log(
    `${state}: located ${located}, ambiguous ${ambiguous}, not found ${missing}${
      saveFailed ? `, ${saveFailed} save failures` : ""
    }`
  );
}

async function run() {
  const states = ALL
    ? ["Karnataka", "Tamil Nadu", "Kerala", "Maharashtra", "Andhra Pradesh", "Telangana"]
    : [STATE_ARG];

  if (states.length === 0 || !states[0]) {
    console.error('Pass --state "Tamil Nadu" or --all');
    process.exit(1);
  }

  for (const s of states) await geocodeState(s);
  console.log("\nBulk pass complete. Run scripts/geocode-missing.ts for the remainder.");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
