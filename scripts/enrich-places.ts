// Enriches the coordinates of EVERY place across all catalogue tables
// (destinations, nearby_destinations, city_places, hotels) using free
// OpenStreetMap Nominatim with a Photon (Komoot) fallback — no API key.
//
// Goal: make each place's stored coordinate land on the real place, so the
// name-based Google Maps links (see src/lib/maps.ts) open the exact spot.
//
// Safety — "snap, don't relocate":
//   • A row with NO valid coordinate accepts any in-India geocode hit.
//   • A row that ALREADY has a coordinate is only refined when the hit is within
//     SNAP_KM of it. A far hit means Nominatim matched a different same-named
//     place elsewhere, so we KEEP the original instead of corrupting it.
//
// Resumable: every processed row id is checkpointed to
// scripts/.enrich-checkpoint.json, so a re-run (or a run after an interruption)
// skips everything already done. Rate-limited to ~1 request/second per
// Nominatim's usage policy.
//
// Run: npm run db:enrich          (all tables)
//      npm run db:enrich hotels   (one or more table names)
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const UA = "YatraPoint/1.0 (place coordinate enrichment; admin@yatrapoint.local)";
const CHECKPOINT = path.join(process.cwd(), "scripts", ".enrich-checkpoint.json");

// Max distance (km) a refinement may move an existing coordinate. Beyond this we
// treat the hit as a wrong match and keep the original.
const SNAP_KM = 12;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round = (n: number) => Math.round(n * 1e6) / 1e6;

type Hit = { lat: number; lng: number };
type OnceResult = Hit | "rate" | null;

function inIndia(h: Hit): boolean {
  return h.lat >= 6 && h.lat <= 36 && h.lng >= 67 && h.lng <= 98;
}

function haversineKm(a: Hit, b: Hit): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
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
    await sleep(1000);
  }
  return null;
}

function baseName(name: string): string {
  return name.split(/\s[—–-]\s|\s*\(/)[0].trim();
}

function validCoord(lat: string | null, lng: string | null): Hit | null {
  if (lat == null || lng == null) return null;
  if (String(lat).trim() === "" || String(lng).trim() === "") return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

// Neon is serverless HTTP — a transient connect timeout shouldn't kill a
// multi-hour run. Retry the write a few times with backoff before giving up.
async function updateCoords(
  db: any,
  table: any,
  eq: any,
  id: string,
  hit: Hit
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await db
        .update(table)
        .set({ latitude: String(hit.lat), longitude: String(hit.lng) })
        .where(eq(table.id, id));
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(2000 * (attempt + 1));
    }
  }
}

function loadCheckpoint(): Set<string> {
  try {
    return new Set(JSON.parse(fs.readFileSync(CHECKPOINT, "utf8")) as string[]);
  } catch {
    return new Set();
  }
}
function saveCheckpoint(done: Set<string>) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify([...done]));
}

async function run() {
  const { db } = await import("../src/lib/db");
  const schema = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  // Per-table: how to build geocoding queries (most specific first).
  const configs: Record<
    string,
    { table: any; queries: (r: any) => string[] }
  > = {
    destinations: {
      table: schema.destinations,
      queries: (r) => [
        [r.name, r.district, r.state, "India"].filter(Boolean).join(", "),
        [baseName(r.name), r.district, r.state, "India"].filter(Boolean).join(", "),
        [baseName(r.name), r.state, "India"].filter(Boolean).join(", "),
      ],
    },
    nearby_destinations: {
      table: schema.nearbyDestinations,
      queries: (r) => [
        [r.name, r.baseCity, "India"].filter(Boolean).join(", "),
        [baseName(r.name), r.baseCity, "India"].filter(Boolean).join(", "),
        [baseName(r.name), "India"].join(", "),
      ],
    },
    city_places: {
      table: schema.cityPlaces,
      queries: (r) => [
        [r.name, r.area, r.city, "India"].filter(Boolean).join(", "),
        [baseName(r.name), r.area, r.city, "India"].filter(Boolean).join(", "),
        [baseName(r.name), r.city, "India"].filter(Boolean).join(", "),
      ],
    },
    hotels: {
      table: schema.hotels,
      queries: (r) => [
        [r.name, r.area, r.city, r.state, "India"].filter(Boolean).join(", "),
        [baseName(r.name), r.city, r.state, "India"].filter(Boolean).join(", "),
        [baseName(r.name), r.city, "India"].filter(Boolean).join(", "),
      ],
    },
  };

  const requested = process.argv.slice(2).filter((a) => a in configs);
  const tableNames = requested.length > 0 ? requested : Object.keys(configs);

  const done = loadCheckpoint();
  const stats = { set: 0, snapped: 0, keptFar: 0, unmatched: 0, skipped: 0, errored: 0 };
  let sinceSave = 0;

  for (const tableName of tableNames) {
    const { table, queries } = configs[tableName];
    const rows: any[] = await db.select().from(table);
    const todo = rows.filter((r) => !done.has(`${tableName}:${r.id}`));
    console.log(
      `\n=== ${tableName}: ${rows.length} rows, ${todo.length} to process (rest checkpointed) ===`
    );

    for (let i = 0; i < todo.length; i++) {
      const r = todo[i];
      const key = `${tableName}:${r.id}`;
      const tag = `[${tableName} ${i + 1}/${todo.length}]`;

      try {
        const existing = validCoord(r.latitude ?? null, r.longitude ?? null);
        const hit = await geocode(queries(r));

        if (!hit) {
          stats.unmatched++;
          console.log(`  ${tag} ✗ no match: ${r.name}`);
        } else if (!existing) {
          await updateCoords(db, table, eq, r.id, hit);
          stats.set++;
          console.log(`  ${tag} + set ${r.name} → ${hit.lat},${hit.lng}`);
        } else {
          const moved = haversineKm(existing, hit);
          if (moved <= SNAP_KM && moved > 0.02) {
            await updateCoords(db, table, eq, r.id, hit);
            stats.snapped++;
            console.log(`  ${tag} ~ snap ${r.name} (${moved.toFixed(2)} km)`);
          } else if (moved > SNAP_KM) {
            stats.keptFar++;
            console.log(`  ${tag} = kept ${r.name} (far hit ${moved.toFixed(1)} km)`);
          } else {
            stats.skipped++; // already essentially exact
          }
        }

        // Only checkpoint a row that fully succeeded, so a transient failure
        // below re-processes it on the next run instead of being skipped.
        done.add(key);
        if (++sinceSave >= 25) {
          saveCheckpoint(done);
          sinceSave = 0;
        }
      } catch (err) {
        stats.errored++;
        console.log(`  ${tag} ! error on ${r.name}: ${(err as Error).message} — will retry next run`);
        saveCheckpoint(done); // persist progress up to the last good row
        await sleep(4000); // back off before the next row after a failure
      }

      await sleep(1200); // ~1 req/sec (Nominatim usage policy)
    }
  }

  saveCheckpoint(done);
  console.log(
    `\nDone. set(new)=${stats.set} snapped=${stats.snapped} keptFar=${stats.keptFar} alreadyExact=${stats.skipped} unmatched=${stats.unmatched}`
  );
  console.log("Re-run any time to retry unmatched/newly-added rows (checkpoint skips finished ones).");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
