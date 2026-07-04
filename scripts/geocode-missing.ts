// Backfill coordinates for catalogue places that have NONE (null / blank /
// 0,0) — e.g. the ~325 imported "top places" across India that were seeded
// without lat/lng, so their detail page can't draw a route.
//
// Only touches rows that are actually missing coordinates, so it never
// overwrites good curated coordinates and is fast to re-run (it just skips
// everything already fixed). Uses OpenStreetMap Nominatim with a Photon
// (Komoot) fallback — both free, no key. Run with:
//   npm run db:geocode-missing
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const UA = "YatraPoint/1.0 (place coordinate backfill; admin@yatrapoint.local)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round = (n: number) => Math.round(n * 1e6) / 1e6;

type Hit = { lat: number; lng: number };
type OnceResult = Hit | "rate" | null;

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

async function photonOnce(query: string): Promise<OnceResult> {
  try {
    const res = await fetch(`${PHOTON}?${new URLSearchParams({ q: query, limit: "1" })}`, {
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

async function withRetry(fn: () => Promise<OnceResult>): Promise<Hit | null> {
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
async function geocode(candidates: string[]): Promise<Hit | null> {
  const seen = new Set<string>();
  for (const raw of candidates) {
    const q = raw.replace(/\s+/g, " ").trim();
    if (!q || seen.has(q)) continue;
    seen.add(q);

    const nom = await withRetry(() => nominatimOnce(q));
    if (nom && inIndia(nom)) return nom;

    const pho = await withRetry(() => photonOnce(q));
    if (pho) return pho;

    await sleep(1000); // pace between candidates
  }
  return null;
}

// "Golden Temple (Harmandir Sahib)" → "Golden Temple"
function baseName(name: string): string {
  return name.split(/\s[—–-]\s|\s*\(/)[0].trim();
}

// A place needs coordinates when it has none, a blank string, a non-number, or
// the bogus (0,0) point off the coast of Africa.
function needsCoords(lat: string | null, lng: string | null): boolean {
  if (lat == null || lng == null) return true;
  if (String(lat).trim() === "" || String(lng).trim() === "") return true;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  if (a === 0 && b === 0) return true;
  return false;
}

async function run() {
  const { db } = await import("../src/lib/db");
  const { destinations } = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({
      id: destinations.id,
      name: destinations.name,
      district: destinations.district,
      state: destinations.state,
      latitude: destinations.latitude,
      longitude: destinations.longitude,
    })
    .from(destinations);

  const missing = rows.filter((r) => needsCoords(r.latitude, r.longitude));
  console.log(
    `Destinations: ${rows.length} total, ${missing.length} missing coordinates to backfill.\n`
  );

  let updated = 0;
  let failed = 0;
  const stillMissing: string[] = [];

  for (let i = 0; i < missing.length; i++) {
    const r = missing[i];
    const base = baseName(r.name);
    const hit = await geocode([
      [r.name, r.district, r.state, "India"].filter(Boolean).join(", "),
      [base, r.district, r.state, "India"].filter(Boolean).join(", "),
      [base, r.state, "India"].filter(Boolean).join(", "),
      [base, "India"].join(", "),
    ]);

    const progress = `[${i + 1}/${missing.length}]`;
    if (hit) {
      await db
        .update(destinations)
        .set({ latitude: String(hit.lat), longitude: String(hit.lng) })
        .where(eq(destinations.id, r.id));
      updated++;
      console.log(`  ${progress} ✓ ${r.name} (${r.state}) → ${hit.lat}, ${hit.lng}`);
    } else {
      failed++;
      stillMissing.push(`${r.name} (${r.state})`);
      console.log(`  ${progress} ✗ ${r.name} (${r.state})`);
    }
    await sleep(1200); // Nominatim usage policy: ~1 request/second.
  }

  console.log(`\nDone. Updated ${updated}, still unmatched ${failed}.`);
  if (stillMissing.length) {
    console.log("\nStill missing (re-run to retry, or add coords by hand):");
    for (const s of stillMissing) console.log(`  - ${s}`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
