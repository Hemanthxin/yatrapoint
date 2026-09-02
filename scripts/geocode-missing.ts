/**
 * Fill in missing coordinates for catalogue places, using Nominatim (OSM).
 *
 * A place with no latitude/longitude is invisible to everything distance-based
 * — "near you", the trip planner, the Food and Shopping tabs, the map. The
 * Karnataka import added 193 places and could only locate 56 of them, because
 * it asked Nominatim exactly one question per place and gave up.
 *
 * This asks several, narrowing from most to least specific:
 *
 *   1. "<name>, <district>, <state>, India"          — the original attempt
 *   2. "<cleaned name>, <district>, <state>, India"  — descriptors removed
 *   3. "<cleaned name>, <state>, India"              — district dropped
 *   4. "<head term>, <district>, <state>, India"     — first clause only
 *
 * Cleaning matters because this list names entries, not map features:
 * "Molakalmuru silk/weaving area" is the town of Molakalmuru, "Dargah and
 * Bahmani heritage circuit" is a route rather than a point. Stripping the
 * descriptive tail turns many of them into something OSM actually holds.
 *
 * A result outside the state's bounding box is rejected rather than stored —
 * Nominatim will happily return a same-named place in another state, and a
 * wrong coordinate is worse than none: it would put the place on the map in
 * the wrong location and drag trip routes across the country.
 *
 *   npx tsx scripts/geocode-missing.ts                  # dry run
 *   npx tsx scripts/geocode-missing.ts --write
 *   npx tsx scripts/geocode-missing.ts --write --state Karnataka
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const WRITE = process.argv.includes("--write");
const STATE_ARG = (() => {
  const i = process.argv.indexOf("--state");
  return i > -1 ? process.argv[i + 1] : "Karnataka";
})();

const DELAY_MS = 1100; // Nominatim policy: at most one request per second
const USER_AGENT = "Saafera/1.0 (+https://saafera.com; catalogue geocoding)";

// Rough bounding boxes, used to reject a confident answer about the wrong
// place. Only states we actually geocode need an entry.
const BBOX: Record<string, [number, number, number, number]> = {
  // [minLat, maxLat, minLng, maxLng]
  karnataka: [11.5, 19.0, 73.5, 79.0],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Descriptive tails that name the ENTRY rather than a mappable feature.
const TAIL =
  /\s*\b(area|region|circuit|precinct|landscape|landscapes|villages|village|zone|trails?|clusters?|corridor|approach|access\s+from\s+\w+\s+side|nearby)\b\s*$/i;

function cleanName(name: string): string {
  let n = name;
  n = n.replace(/\s*\([^)]*\)\s*/g, " "); // drop parenthetical alternates
  n = n.split("/")[0]; // "Molakalmuru silk/weaving area" → "Molakalmuru silk"
  // Strip the descriptive tail repeatedly: "heritage circuit" is two words.
  for (let i = 0; i < 3; i += 1) n = n.replace(TAIL, "");
  return n.replace(/\s+/g, " ").trim();
}

// The first meaningful clause — "Chennakeshava Temple, Somanathapura" is
// better found as "Somanathapura", and "Kaiwara Tatayya memorial" as "Kaiwara".
function headTerm(name: string): string {
  const cleaned = cleanName(name);
  const comma = cleaned.split(",");
  if (comma.length > 1) return comma[comma.length - 1].trim();
  return cleaned.split(/\s+/)[0];
}

interface Hit {
  lat: number;
  lng: number;
  via: string;
  district: string | null;
}

// Nominatim's own name for the district containing the hit. This is how rows
// imported from a list with NO district get one — asked of OpenStreetMap
// rather than guessed from the name, which is the only way to get it right for
// entries like "Oyster Rock" or "Jomlu Theertha".
function districtFrom(address: Record<string, string> | undefined): string | null {
  if (!address) return null;
  const raw =
    address.state_district ??
    address.county ??
    address.district ??
    address.region ??
    null;
  if (!raw) return null;
  // OSM writes "Bagalkot District", "Mysuru district" — drop the suffix.
  return raw.replace(/\s+district$/i, "").trim() || null;
}

async function ask(q: string, state: string, via: string): Promise<Hit | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q,
      format: "json",
      limit: "1",
      countrycodes: "in",
      addressdetails: "1",
    }).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      lat: string;
      lon: string;
      address?: Record<string, string>;
    }>;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const lat = Number(rows[0].lat);
    const lng = Number(rows[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const box = BBOX[state.toLowerCase()];
    if (box && (lat < box[0] || lat > box[1] || lng < box[2] || lng > box[3])) return null;
    return { lat, lng, via, district: districtFrom(rows[0].address) };
  } catch {
    return null;
  }
}

async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  const res = await db.execute(sql`
    SELECT slug, name, district, state
    FROM places
    WHERE (latitude IS NULL OR longitude IS NULL)
      AND lower(coalesce(state, '')) = ${STATE_ARG.toLowerCase()}
    ORDER BY district, name
  `);
  const rows = (res.rows ?? res) as Array<{
    slug: string;
    name: string;
    district: string | null;
    state: string;
  }>;

  console.log(`${STATE_ARG}: ${rows.length} places without coordinates`);
  if (rows.length === 0) process.exit(0);

  if (!WRITE) {
    console.log("\nWould try up to 4 Nominatim queries each, ~1.1s apart.");
    console.log(`Estimated time: ~${Math.round((rows.length * 2.5 * 1.1) / 60)} min\n`);
    for (const r of rows.slice(0, 20)) {
      console.log(`  ${r.name}`);
      console.log(`      cleaned: "${cleanName(r.name)}"   head: "${headTerm(r.name)}"`);
    }
    if (rows.length > 20) console.log(`  … and ${rows.length - 20} more`);
    console.log("\nDRY RUN — pass --write to geocode and save.");
    process.exit(0);
  }

  let located = 0;
  let n = 0;

  for (const r of rows) {
    n += 1;
    const d = r.district ?? "";
    const cleaned = cleanName(r.name);
    const head = headTerm(r.name);

    // With no district there is nothing to narrow by, so the district-bearing
    // variants collapse into the plain ones and are skipped below.
    const withD = (s: string) => (d ? `${s}, ${d}, ${r.state}, India` : `${s}, ${r.state}, India`);

    const attempts: Array<[string, string]> = [
      [withD(r.name), "full"],
      [withD(cleaned), "cleaned"],
      [`${cleaned}, ${r.state}, India`, "cleaned/no-district"],
      [withD(head), "head"],
    ];

    // Drop duplicates — for a simple name all four collapse to one query, and
    // asking Nominatim the same thing four times would be rude and pointless.
    const seen = new Set<string>();
    let hit: Hit | null = null;

    for (const [q, via] of attempts) {
      if (seen.has(q)) continue;
      seen.add(q);
      hit = await ask(q, r.state, via);
      await sleep(DELAY_MS);
      if (hit) break;
    }

    if (hit) {
      // Only fill a district in, never overwrite one — a curated district
      // beats whatever administrative unit OSM happens to name.
      if (hit.district && !r.district) {
        await db.execute(sql`
          UPDATE places
          SET latitude = ${String(hit.lat)}, longitude = ${String(hit.lng)}, district = ${hit.district}
          WHERE slug = ${r.slug}
        `);
      } else {
        await db.execute(sql`
          UPDATE places
          SET latitude = ${String(hit.lat)}, longitude = ${String(hit.lng)}
          WHERE slug = ${r.slug}
        `);
      }
      located += 1;
      const dTag = hit.district && !r.district ? ` ${hit.district}` : "";
      console.log(`  [${n}/${rows.length}] ✓ ${r.name} → ${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}${dTag} (${hit.via})`);
    } else {
      console.log(`  [${n}/${rows.length}] ✗ ${r.name}`);
    }
  }

  console.log(`\nDone. Located ${located} of ${rows.length}.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
