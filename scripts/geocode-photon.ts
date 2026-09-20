/**
 * Fast geocoding pass using Photon (OSM), with a district-distance guard.
 *
 * WHY NOT JUST NOMINATIM
 * ----------------------
 * scripts/geocode-missing.ts uses Nominatim, whose usage policy caps it at one
 * request per second — about seven hours for the ~9,000 imported places.
 * Photon answers the same kind of fuzzy query in ~500ms and is not capped that
 * hard, which brings the same work down to roughly an hour.
 *
 * WHY IT NEEDS A GUARD
 * --------------------
 * Photon almost always returns something, and "something" is not "the right
 * thing". Asked for "Nemili temple streets" in Ranipet it confidently returns
 * a temple in Tiruporur, 90 km away. Accepting that would put the place on the
 * map in the wrong town and drag every distance calculation and trip route
 * with it — worse than having no coordinate at all.
 *
 * So each state's districts are geocoded once up front, and a result is only
 * accepted when it lands within MAX_DISTRICT_KM of the centre of the district
 * the place is supposed to be in. Rows with no district fall back to the
 * state bounding box. Whatever this rejects is left for the Nominatim pass,
 * which is slower but asks a differently-shaped question.
 *
 *   npx tsx scripts/geocode-photon.ts --state "Tamil Nadu"          # dry run
 *   npx tsx scripts/geocode-photon.ts --state "Tamil Nadu" --write
 *   npx tsx scripts/geocode-photon.ts --all --write
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const WRITE = process.argv.includes("--write");
const ALL = process.argv.includes("--all");
const REVALIDATE = process.argv.includes("--revalidate");
const STATE_ARG = (() => {
  const i = process.argv.indexOf("--state");
  return i > -1 ? process.argv[i + 1] : "";
})();

const STATES = ["Karnataka", "Tamil Nadu", "Kerala", "Maharashtra", "Andhra Pradesh", "Telangana"];

// [minLat, maxLat, minLng, maxLng] — the coarse net, used when a row has no
// district to check against.
const BBOX: Record<string, [number, number, number, number]> = {
  karnataka: [11.5, 19.0, 73.5, 79.0],
  "tamil nadu": [8.0, 13.6, 76.2, 80.4],
  kerala: [8.1, 12.9, 74.8, 77.5],
  maharashtra: [15.6, 22.1, 72.6, 80.9],
  "andhra pradesh": [12.6, 19.95, 76.7, 84.8],
  telangana: [15.8, 19.95, 77.2, 81.4],
};

// Generous enough for a large district, tight enough to catch a hit in the
// wrong part of the state.
const MAX_DISTRICT_KM = 90;

const DELAY_MS = 350;
const USER_AGENT = "Saafera/1.0 (+https://saafera.com; catalogue geocoding)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Pt {
  lat: number;
  lng: number;
}

function haversineKm(a: Pt, b: Pt): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Descriptive tails that name the entry rather than a mappable feature.
const TAIL =
  /\s*\b(area|region|circuit|precinct|landscape|landscapes|villages|village|zone|trails?|clusters?|corridor|approach|nearby|heritage)\b\s*$/i;

function cleanName(name: string): string {
  let n = name.replace(/\s*\([^)]*\)\s*/g, " ").split("/")[0];
  for (let i = 0; i < 3; i += 1) n = n.replace(TAIL, "");
  return n.replace(/\s+/g, " ").trim();
}

interface PhotonHit extends Pt {
  // What OSM actually calls the thing that was returned.
  label: string;
}

// Words that appear in half the place names in India and so identify nothing.
const COMMON = new Set([
  "temple", "fort", "lake", "hill", "hills", "beach", "falls", "park", "museum",
  "palace", "church", "dam", "river", "road", "street", "old", "new", "sri",
  "shri", "the", "and", "of", "state", "district", "village", "town", "city",
  "heritage", "point", "view", "area", "national", "wildlife", "sanctuary",
]);

function distinctive(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !COMMON.has(t));
}

/**
 * Did Photon return the place we asked for, or just something near it?
 *
 * Distance from the district centre is far too weak a test on its own: asked
 * for "Kokkarebellur Bird Sanctuary" it returned a point 45 km away that was
 * still inside Mandya, and asked for "Kumbakonam brass craft street" it
 * returned a nursing home. Both passed a distance check and both are wrong.
 *
 * A name check catches them. At least one distinctive word — not "temple" or
 * "fort", which identify nothing — has to survive into whatever OSM calls the
 * result. A place whose name is made entirely of common words has nothing to
 * check against, so it is refused here and left to the slower pass.
 */
function nameMatches(asked: string, got: string): boolean {
  const want = distinctive(asked);
  if (want.length === 0) return false;
  const have = got.toLowerCase().replace(/[^a-z0-9\s]+/g, " ");
  return want.some((t) => have.includes(t));
}

async function photon(q: string): Promise<PhotonHit | null> {
  const url =
    "https://photon.komoot.io/api?" +
    new URLSearchParams({ q, limit: "1" }).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: Record<string, string>;
      }>;
    };
    const f = json.features?.[0];
    const c = f?.geometry?.coordinates;
    if (!c || c.length < 2) return null;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const p = f?.properties ?? {};
    const label = [p.name, p.street, p.city, p.county, p.district].filter(Boolean).join(" ");
    return { lat, lng, label };
  } catch {
    return null;
  }
}

/**
 * Re-check coordinates that are ALREADY stored on imported rows.
 *
 * An earlier run of this script accepted a result on distance from the
 * district centre alone, before the name check existed, and put some pins
 * tens of kilometres from the actual place — Kokkarebellur Bird Sanctuary
 * landed 45 km away but still inside Mandya, so the distance test passed it.
 *
 * This asks Photon again and clears the coordinate when the answer no longer
 * looks like the place, so the next pass can have another go. Only rows from
 * the bulk imports are touched (no `added_by_email`, popularity 40 or 45) —
 * curated and admin-entered coordinates are never second-guessed.
 */
async function revalidateState(state: string): Promise<void> {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  const res = await db.execute(sql`
    SELECT slug, name, district, latitude, longitude FROM places
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      AND lower(coalesce(state, '')) = ${state.toLowerCase()}
      AND added_by_email IS NULL
      AND popularity IN (40, 45)
    ORDER BY district, name
  `);
  const rows = (res.rows ?? res) as Array<{
    slug: string;
    name: string;
    district: string | null;
    latitude: string;
    longitude: string;
  }>;

  console.log(`\n=== ${state}: re-checking ${rows.length} imported coordinates ===`);
  if (rows.length === 0 || !WRITE) {
    if (!WRITE) console.log("DRY RUN — pass --write to clear bad pins.");
    return;
  }

  let kept = 0;
  let cleared = 0;
  let n = 0;

  for (const r of rows) {
    n += 1;
    const d = r.district ?? "";
    const q = d ? `${r.name}, ${d}, ${state}, India` : `${r.name}, ${state}, India`;
    const p = await photon(q);
    await sleep(DELAY_MS);

    // Only clear on a confident disagreement. No answer at all is not
    // evidence the stored coordinate is wrong.
    if (!p) {
      kept += 1;
      continue;
    }
    if (nameMatches(r.name, p.label)) {
      kept += 1;
      continue;
    }

    const stored = { lat: Number(r.latitude), lng: Number(r.longitude) };
    // The name did not match, but if the stored point is where Photon points
    // anyway then it is very likely right and merely labelled differently.
    if (Number.isFinite(stored.lat) && haversineKm(stored, p) < 5) {
      kept += 1;
      continue;
    }

    try {
      await db.execute(sql`
        UPDATE places SET latitude = NULL, longitude = NULL WHERE slug = ${r.slug}
      `);
      cleared += 1;
    } catch {
      /* leave it; the next run will look again */
    }
    if (n % 100 === 0) console.log(`  [${n}/${rows.length}] kept ${kept}, cleared ${cleared}`);
  }

  console.log(`${state}: kept ${kept}, cleared ${cleared} for re-geocoding`);
}

async function geocodeState(state: string): Promise<void> {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  const box = BBOX[state.toLowerCase()];
  const inState = (p: Pt) =>
    !box || (p.lat >= box[0] && p.lat <= box[1] && p.lng >= box[2] && p.lng <= box[3]);

  const res = await db.execute(sql`
    SELECT slug, name, district FROM places
    WHERE (latitude IS NULL OR longitude IS NULL)
      AND lower(coalesce(state, '')) = ${state.toLowerCase()}
    ORDER BY district, name
  `);
  const rows = (res.rows ?? res) as Array<{
    slug: string;
    name: string;
    district: string | null;
  }>;

  console.log(`\n=== ${state}: ${rows.length} without coordinates ===`);
  if (rows.length === 0) return;

  if (!WRITE) {
    console.log(`Would geocode ~${rows.length} places at ~${DELAY_MS}ms each (~${Math.round((rows.length * DELAY_MS * 1.6) / 60000)} min).`);
    console.log("DRY RUN — pass --write to save.");
    return;
  }

  // Locate each district once. Every place in it is then checked against this
  // point, which is what stops a confident answer about the wrong town.
  const districts = [...new Set(rows.map((r) => r.district).filter((d): d is string => !!d))];
  const centre = new Map<string, Pt>();
  console.log(`locating ${districts.length} districts…`);
  for (const d of districts) {
    const p = await photon(`${d} district, ${state}, India`);
    await sleep(DELAY_MS);
    if (p && inState(p)) centre.set(d, { lat: p.lat, lng: p.lng });
  }
  console.log(`  ${centre.size}/${districts.length} district centres found`);

  let located = 0;
  let rejected = 0;
  let missing = 0;
  let saveFailed = 0;
  let n = 0;

  for (const r of rows) {
    n += 1;
    const d = r.district ?? "";
    const cleaned = cleanName(r.name);

    const queries = [
      d ? `${r.name}, ${d}, ${state}, India` : `${r.name}, ${state}, India`,
      d ? `${cleaned}, ${d}, ${state}, India` : `${cleaned}, ${state}, India`,
    ];

    let hit: Pt | null = null;
    const tried = new Set<string>();
    for (const q of queries) {
      if (tried.has(q)) continue;
      tried.add(q);
      const p = await photon(q);
      await sleep(DELAY_MS);
      if (!p || !inState(p)) continue;

      // The name has to survive into the result, or we located something else.
      if (!nameMatches(r.name, p.label)) {
        rejected += 1;
        continue;
      }

      const c = d ? centre.get(d) : undefined;
      if (c && haversineKm(c, p) > MAX_DISTRICT_KM) {
        rejected += 1;
        continue; // right name, wrong part of the state
      }
      hit = { lat: p.lat, lng: p.lng };
      break;
    }

    if (!hit) {
      // Distinguish "nothing came back" from "came back somewhere wrong" only
      // loosely — both end up with the Nominatim pass.
      missing += 1;
      if (n % 100 === 0) console.log(`  [${n}/${rows.length}] located ${located}, unresolved ${missing + rejected}`);
      continue;
    }

    try {
      await db.execute(sql`
        UPDATE places
        SET latitude = ${String(hit.lat)}, longitude = ${String(hit.lng)}
        WHERE slug = ${r.slug}
      `);
      located += 1;
    } catch {
      saveFailed += 1;
    }

    if (n % 100 === 0) {
      console.log(`  [${n}/${rows.length}] located ${located}, unresolved ${missing + rejected}`);
    }
  }

  console.log(
    `${state}: located ${located} of ${rows.length}${saveFailed ? `, ${saveFailed} save failures` : ""}`
  );
}

async function run() {
  const list = ALL ? STATES : [STATE_ARG];
  if (!list[0]) {
    console.error('Pass --state "Tamil Nadu" or --all');
    process.exit(1);
  }
  for (const s of list) {
    if (REVALIDATE) await revalidateState(s);
    await geocodeState(s);
  }
  console.log("\nPhoton pass complete. Run scripts/geocode-missing.ts for the remainder.");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
