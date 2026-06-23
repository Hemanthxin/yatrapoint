// Re-geocode EXISTING places to accurate coordinates using OpenStreetMap
// Nominatim (free, no key). Run with:  npm run db:fix-coords
//
// Hardened version: retries on rate-limiting (HTTP 429/503) and falls back to
// simpler queries so well-known places aren't missed. Safe to re-run — it only
// overwrites a place when it finds a confident match, otherwise it keeps the
// existing value. OSM-sourced city_places are skipped (already exact).
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "YatraPoint/1.0 (place coordinate fixer; admin@yatrapoint.local)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

type Hit = { lat: number; lng: number };
type Bias = { lat: number; lng: number };
type OnceResult = Hit | "rate" | null;

const PHOTON = "https://photon.komoot.io/api/";

// Rough India bounding box — reject any result that lands outside it.
function inIndia(h: Hit): boolean {
  return h.lat >= 6 && h.lat <= 36 && h.lng >= 67 && h.lng <= 98;
}

async function nominatimOnce(query: string): Promise<OnceResult> {
  const url =
    `${NOMINATIM}?` +
    new URLSearchParams({ format: "jsonv2", q: query, limit: "1", countrycodes: "in" }).toString();
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 429 || res.status === 503) return "rate";
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!rows[0]) return null;
    const lat = Number(rows[0].lat);
    const lng = Number(rows[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat: round(lat), lng: round(lng) };
  } catch {
    return "rate";
  }
}

// Photon (Komoot) — far better at fuzzy POI names. Proximity-biased, not
// country-filtered, so we bounds-check the result against India.
async function photonOnce(query: string, bias?: Bias): Promise<OnceResult> {
  const params = new URLSearchParams({ q: query, limit: "1" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  try {
    const res = await fetch(`${PHOTON}?${params.toString()}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (res.status === 429 || res.status === 503) return "rate";
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
    };
    const c = data.features?.[0]?.geometry?.coordinates;
    if (!c) return null;
    const hit = { lat: round(c[1]), lng: round(c[0]) };
    if (Number.isNaN(hit.lat) || Number.isNaN(hit.lng) || !inIndia(hit)) return null;
    return hit;
  } catch {
    return "rate";
  }
}

async function withRetry(
  fn: () => Promise<OnceResult>
): Promise<Hit | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fn();
    if (r === "rate") {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    return r;
  }
  return null;
}

// Try each candidate query against Nominatim, then Photon, until one resolves.
async function geocode(candidates: string[], bias?: Bias): Promise<Hit | null> {
  const seen = new Set<string>();
  for (const raw of candidates) {
    const q = raw.replace(/\s+/g, " ").trim();
    if (!q || seen.has(q)) continue;
    seen.add(q);

    const nom = await withRetry(() => nominatimOnce(q));
    if (nom && inIndia(nom)) return nom;

    const pho = await withRetry(() => photonOnce(q, bias));
    if (pho) return pho;

    await sleep(1000); // pace between candidates
  }
  return null;
}

const BLR: Bias = { lat: 12.9716, lng: 77.5946 };

// "Truffles — St Mark's Road" → { base: "Truffles", suffix: "St Mark's Road" }
// "Meghana Foods (Residency Road)" → { base, suffix }
function splitName(name: string): { base: string; suffix?: string } {
  const m = name.split(/\s[—–-]\s|\s*\(/);
  const base = m[0].trim();
  const suffix = m[1] ? m[1].replace(/\)$/, "").trim() : undefined;
  return { base, suffix };
}

const OSM_SLUG = /-(node|way|relation)-\d+$/i;

async function run() {
  const { db } = await import("../src/lib/db");
  const { destinations, nearbyDestinations, cityPlaces } = await import(
    "../src/lib/db/schema"
  );
  const { eq } = await import("drizzle-orm");

  let updated = 0;
  let failed = 0;

  // 1) Destinations
  const dRows = await db
    .select({
      id: destinations.id,
      name: destinations.name,
      district: destinations.district,
      state: destinations.state,
    })
    .from(destinations);
  console.log(`\nDestinations: ${dRows.length}`);
  for (const r of dRows) {
    const { base } = splitName(r.name);
    const hit = await geocode([
      [r.name, r.district, r.state, "India"].filter(Boolean).join(", "),
      [base, r.district, r.state, "India"].filter(Boolean).join(", "),
      [base, r.state, "India"].filter(Boolean).join(", "),
      [base, "India"].join(", "),
    ]);
    if (hit) {
      await db
        .update(destinations)
        .set({ latitude: String(hit.lat), longitude: String(hit.lng) })
        .where(eq(destinations.id, r.id));
      updated++;
      console.log(`  ✓ ${r.name} → ${hit.lat}, ${hit.lng}`);
    } else {
      failed++;
      console.log(`  ✗ ${r.name}`);
    }
    await sleep(1200);
  }

  // 2) Nearby destinations
  const nRows = await db
    .select({
      id: nearbyDestinations.id,
      name: nearbyDestinations.name,
      baseCity: nearbyDestinations.baseCity,
    })
    .from(nearbyDestinations);
  console.log(`\nNearby destinations: ${nRows.length}`);
  for (const r of nRows) {
    const { base } = splitName(r.name);
    const hit = await geocode(
      [
        [r.name, r.baseCity, "India"].filter(Boolean).join(", "),
        [base, r.baseCity, "India"].filter(Boolean).join(", "),
        [base, "Karnataka", "India"].join(", "),
        [base, "India"].join(", "),
      ],
      BLR
    );
    if (hit) {
      await db
        .update(nearbyDestinations)
        .set({ latitude: String(hit.lat), longitude: String(hit.lng) })
        .where(eq(nearbyDestinations.id, r.id));
      updated++;
      console.log(`  ✓ ${r.name} → ${hit.lat}, ${hit.lng}`);
    } else {
      failed++;
      console.log(`  ✗ ${r.name}`);
    }
    await sleep(1200);
  }

  // 3) Curated city places (skip OSM-sourced)
  const cRows = await db
    .select({
      id: cityPlaces.id,
      slug: cityPlaces.slug,
      name: cityPlaces.name,
      area: cityPlaces.area,
      city: cityPlaces.city,
    })
    .from(cityPlaces);
  const curated = cRows.filter((r) => !OSM_SLUG.test(r.slug));
  console.log(
    `\nCity places: ${cRows.length} (curated to fix: ${curated.length}, OSM skipped: ${cRows.length - curated.length})`
  );
  for (const r of curated) {
    const { base, suffix } = splitName(r.name);
    const city = r.city || "Bengaluru";
    const hit = await geocode(
      [
        [r.name, r.area, city, "India"].filter(Boolean).join(", "),
        [base, suffix, city, "India"].filter(Boolean).join(", "),
        [base, r.area, city, "India"].filter(Boolean).join(", "),
        [base, city, "India"].join(", "),
      ],
      BLR
    );
    if (hit) {
      await db
        .update(cityPlaces)
        .set({ latitude: String(hit.lat), longitude: String(hit.lng) })
        .where(eq(cityPlaces.id, r.id));
      updated++;
      console.log(`  ✓ ${r.name} → ${hit.lat}, ${hit.lng}`);
    } else {
      failed++;
      console.log(`  ✗ ${r.name}`);
    }
    await sleep(1200);
  }

  console.log(
    `\nDone. Updated ${updated}, still-unmatched ${failed}, OSM skipped ${cRows.length - curated.length}.`
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
