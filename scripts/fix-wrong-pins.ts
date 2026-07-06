// Find places whose stored coordinates fall OUTSIDE their state (a "completely
// wrong" pin) and re-geocode them. Validates every candidate fix against the
// state's bounding box so we never replace one wrong pin with another.
//   npm run db:fix-pins
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const UA = "YatraPoint/1.0 (wrong-pin fixer; admin@yatrapoint.local)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round = (n: number) => Math.round(n * 1e6) / 1e6;

type Box = { s: number; n: number; w: number; e: number };
type Hit = { lat: number; lng: number };

// State bounding box (with a margin) — coordinates must fall inside this.
const MARGIN = 0.35; // ~38 km slack for border towns / bbox imprecision
async function stateBox(state: string): Promise<Box | null> {
  const url =
    `${NOMINATIM}?` +
    new URLSearchParams({
      format: "jsonv2",
      q: `${state}, India`,
      limit: "1",
      countrycodes: "in",
    }).toString();
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ boundingbox?: [string, string, string, string] }>;
    const bb = rows[0]?.boundingbox;
    if (!bb) return null;
    const [s, n, w, e] = bb.map(Number);
    return { s: s - MARGIN, n: n + MARGIN, w: w - MARGIN, e: e + MARGIN };
  } catch {
    return null;
  }
}

const inBox = (b: Box, lat: number, lng: number) =>
  lat >= b.s && lat <= b.n && lng >= b.w && lng <= b.e;

async function nominatim(q: string): Promise<Hit | null> {
  try {
    const res = await fetch(
      `${NOMINATIM}?` + new URLSearchParams({ format: "jsonv2", q, limit: "1", countrycodes: "in" }),
      { headers: { "User-Agent": UA, Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!rows[0]) return null;
    const lat = Number(rows[0].lat), lng = Number(rows[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat: round(lat), lng: round(lng) } : null;
  } catch {
    return null;
  }
}
async function photon(q: string): Promise<Hit | null> {
  try {
    const res = await fetch(`${PHOTON}?` + new URLSearchParams({ q, limit: "1" }), {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: Array<{ geometry?: { coordinates?: [number, number] } }> };
    const c = data.features?.[0]?.geometry?.coordinates;
    if (!c) return null;
    return { lat: round(c[1]), lng: round(c[0]) };
  } catch {
    return null;
  }
}

function base(name: string): string {
  return name.split(/\s[—–-]\s|\s*\(/)[0].trim();
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

  // Resolve each state's bbox once.
  const states = [...new Set(rows.map((r) => r.state))];
  console.log(`Fetching bounding boxes for ${states.length} states…`);
  const boxes = new Map<string, Box>();
  for (const st of states) {
    const b = await stateBox(st);
    if (b) boxes.set(st, b);
    else console.log(`  ! no bbox for "${st}" — its places will be skipped`);
    await sleep(1100);
  }

  // Which places sit outside their state?
  const wrong = rows.filter((r) => {
    const b = boxes.get(r.state);
    const lat = Number(r.latitude), lng = Number(r.longitude);
    if (!b || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return !inBox(b, lat, lng);
  });
  console.log(`\n${wrong.length} places have a pin OUTSIDE their state. Re-geocoding…\n`);

  let fixed = 0, unresolved = 0;
  for (let i = 0; i < wrong.length; i++) {
    const r = wrong[i];
    const b = boxes.get(r.state)!;
    const candidates = [
      [r.name, r.district, r.state, "India"].filter(Boolean).join(", "),
      [base(r.name), r.district, r.state, "India"].filter(Boolean).join(", "),
      [base(r.name), r.state, "India"].join(", "),
    ];
    let hit: Hit | null = null;
    for (const q of candidates) {
      const nm = await nominatim(q);
      if (nm && inBox(b, nm.lat, nm.lng)) { hit = nm; break; }
      const ph = await photon(q);
      if (ph && inBox(b, ph.lat, ph.lng)) { hit = ph; break; }
      await sleep(1100);
    }
    const tag = `[${i + 1}/${wrong.length}]`;
    if (hit) {
      await db.update(destinations).set({ latitude: String(hit.lat), longitude: String(hit.lng) }).where(eq(destinations.id, r.id));
      fixed++;
      console.log(`  ${tag} ✓ ${r.name} (${r.state}) → ${hit.lat}, ${hit.lng}`);
    } else {
      unresolved++;
      console.log(`  ${tag} ✗ ${r.name} (${r.state}) — no in-state match found`);
    }
  }

  console.log(`\nDone. Fixed ${fixed}, still-wrong ${unresolved} (of ${wrong.length}).`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
