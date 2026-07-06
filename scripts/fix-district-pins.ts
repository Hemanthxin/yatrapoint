// Finer wrong-pin pass: validate each place against its DISTRICT centroid to
// catch pins that are in the right state but the wrong town (e.g. a same-named
// place geocoded to a different city). Flags places far from their district and
// re-geocodes them, accepting a fix only if it lands near the district.
//   npm run db:fix-district-pins
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const UA = "YatraPoint/1.0 (district pin fixer; admin@yatrapoint.local)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round = (n: number) => Math.round(n * 1e6) / 1e6;

const FLAG_KM = 150; // farther than this from its district ⇒ suspicious
const ACCEPT_KM = 120; // a re-geocode is accepted only if within this of the district

type Hit = { lat: number; lng: number };
function haversineKm(a: Hit, b: Hit): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

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
    return c ? { lat: round(c[1]), lng: round(c[0]) } : null;
  } catch {
    return null;
  }
}
const baseName = (n: string) => n.split(/\s[—–-]\s|\s*\(/)[0].trim();

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

  // Geocode each distinct district centroid once.
  const withDistrict = rows.filter((r) => r.district && r.district.trim());
  const districts = [...new Set(withDistrict.map((r) => `${r.district}|${r.state}`))];
  console.log(`Places with a district: ${withDistrict.length}. Geocoding ${districts.length} district centroids…`);

  const centroid = new Map<string, Hit>();
  for (const key of districts) {
    const [district, state] = key.split("|");
    const hit = (await nominatim(`${district}, ${state}, India`)) ?? (await photon(`${district}, ${state}, India`));
    if (hit) centroid.set(key, hit);
    await sleep(1100);
  }
  console.log(`Resolved ${centroid.size}/${districts.length} district centroids.\n`);

  // Flag places far from their district centroid.
  const flagged = withDistrict.filter((r) => {
    const c = centroid.get(`${r.district}|${r.state}`);
    const lat = Number(r.latitude), lng = Number(r.longitude);
    if (!c || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return haversineKm({ lat, lng }, c) > FLAG_KM;
  });
  console.log(`${flagged.length} places sit > ${FLAG_KM} km from their district. Re-geocoding…\n`);

  let fixed = 0, left = 0;
  for (let i = 0; i < flagged.length; i++) {
    const r = flagged[i];
    const c = centroid.get(`${r.district}|${r.state}`)!;
    const candidates = [
      [r.name, r.district, r.state, "India"].filter(Boolean).join(", "),
      [baseName(r.name), r.district, r.state, "India"].filter(Boolean).join(", "),
    ];
    let hit: Hit | null = null;
    for (const q of candidates) {
      const nm = await nominatim(q);
      if (nm && haversineKm(nm, c) <= ACCEPT_KM) { hit = nm; break; }
      const ph = await photon(q);
      if (ph && haversineKm(ph, c) <= ACCEPT_KM) { hit = ph; break; }
      await sleep(1100);
    }
    const tag = `[${i + 1}/${flagged.length}]`;
    if (hit) {
      await db.update(destinations).set({ latitude: String(hit.lat), longitude: String(hit.lng) }).where(eq(destinations.id, r.id));
      fixed++;
      console.log(`  ${tag} ✓ ${r.name} (${r.district}, ${r.state}) → ${hit.lat}, ${hit.lng}`);
    } else {
      left++;
      console.log(`  ${tag} ✗ ${r.name} (${r.district}, ${r.state}) — kept (no confident district match)`);
    }
  }
  console.log(`\nDone. Fixed ${fixed}, kept ${left} (of ${flagged.length} flagged).`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
