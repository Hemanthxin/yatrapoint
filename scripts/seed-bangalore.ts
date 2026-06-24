// Exhaustively seed EVERY visit-worthy place in the Bengaluru region from
// OpenStreetMap via Overpass (free, no key). Run with:  npm run db:seed:bangalore
//
// Unlike the radius-based seeder, this tiles a bounding box over Greater
// Bengaluru into a grid of cells and queries each cell's bbox for all
// categories — so there are no coverage gaps. Results are de-duped by OSM id
// and bulk-inserted into city_places (skipping anything already there).
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Greater Bengaluru bounding box [south, west, north, east].
const BBOX = { south: 12.78, west: 77.40, north: 13.16, east: 77.82 };
const STEP = 0.05; // ~5.5 km tiles
const CAP = 1500; // max elements per tile

// Category → OSM tag filters (visit-worthy POIs only, named).
const CATEGORY_FILTERS: Record<string, string[]> = {
  temple: ["amenity=place_of_worship][religion=hindu"],
  church: ["amenity=place_of_worship][religion=christian"],
  mosque: ["amenity=place_of_worship][religion=muslim"],
  worship: ["amenity=place_of_worship"],
  museum: ["tourism=museum"],
  gallery: ["tourism=gallery"],
  park: ["leisure=park"],
  garden: ["leisure=garden"],
  lake: ["natural=water][water=lake", "natural=water][water=reservoir"],
  viewpoint: ["tourism=viewpoint"],
  monument: ["historic=monument", "historic=memorial"],
  fort: ["historic=fort", "historic=castle"],
  ruins: ["historic=ruins", "historic=archaeological_site"],
  attraction: ["tourism=attraction", "tourism=artwork", "tourism=aquarium"],
  restaurant: ["amenity=restaurant"],
  cafe: ["amenity=cafe"],
  fast_food: ["amenity=fast_food"],
  nightlife: ["amenity=bar", "amenity=pub", "amenity=nightclub"],
  mall: ["shop=mall"],
  marketplace: ["amenity=marketplace"],
  cinema: ["amenity=cinema"],
  theatre: ["amenity=theatre"],
  zoo: ["tourism=zoo"],
  amusement: ["tourism=theme_park", "leisure=water_park"],
  stadium: ["leisure=stadium"],
  sports: ["leisure=sports_centre"],
};

const KIND: Record<string, string> = {
  temple: "temple", church: "church", mosque: "temple", worship: "temple",
  museum: "museum", gallery: "museum",
  park: "park", garden: "park",
  lake: "lake", viewpoint: "viewpoint",
  monument: "attraction", fort: "attraction", ruins: "attraction", attraction: "attraction",
  restaurant: "restaurant", cafe: "restaurant", fast_food: "restaurant",
  nightlife: "nightlife", mall: "mall", marketplace: "market",
  cinema: "attraction", theatre: "attraction", zoo: "attraction", amusement: "attraction",
  stadium: "attraction", sports: "attraction",
};

const DEFAULTS: Record<string, { minutes: number; costForTwo?: number }> = {
  temple: { minutes: 30 }, church: { minutes: 30 }, mosque: { minutes: 30 }, worship: { minutes: 30 },
  museum: { minutes: 90 }, gallery: { minutes: 60 },
  park: { minutes: 60 }, garden: { minutes: 60 },
  lake: { minutes: 45 }, viewpoint: { minutes: 45 },
  monument: { minutes: 45 }, fort: { minutes: 60 }, ruins: { minutes: 45 }, attraction: { minutes: 60 },
  restaurant: { minutes: 60, costForTwo: 700 }, cafe: { minutes: 45, costForTwo: 400 },
  fast_food: { minutes: 30, costForTwo: 300 },
  nightlife: { minutes: 120, costForTwo: 1600 },
  mall: { minutes: 90 }, marketplace: { minutes: 45 },
  cinema: { minutes: 180 }, theatre: { minutes: 150 }, zoo: { minutes: 120 }, amusement: { minutes: 240 },
  stadium: { minutes: 120 }, sports: { minutes: 90 },
};

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const UA = "YatraPoint/1.0 (Bengaluru place seeder; admin@yatrapoint.local)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RawPlace {
  osmId: string;
  name: string;
  cat: string;
  lat: number;
  lng: number;
  area?: string;
  fee?: string;
  charge?: string;
}

function buildQuery(s: number, w: number, n: number, e: number): string {
  const box = `(${s},${w},${n},${e})`;
  const clauses: string[] = [];
  for (const filters of Object.values(CATEGORY_FILTERS)) {
    for (const f of filters) {
      clauses.push(`node[${f}][name]${box};`);
      clauses.push(`way[${f}][name]${box};`);
    }
  }
  return `[out:json][timeout:90];(${clauses.join("")});out tags center ${CAP};`;
}

function detectCat(tags: Record<string, string>): string | null {
  for (const [cat, filters] of Object.entries(CATEGORY_FILTERS)) {
    const match = filters.some((f) =>
      f.split("][").every((part) => {
        const [k, v] = part.split("=");
        return tags[k] === v;
      })
    );
    if (match) return cat;
  }
  return null;
}

async function fetchTile(s: number, w: number, n: number, e: number): Promise<RawPlace[]> {
  const query = buildQuery(s, w, n, e);
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": UA,
            Accept: "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (res.status === 429 || res.status === 504) continue;
        if (!res.ok) continue;
        const data = (await res.json()) as {
          elements: Array<{
            type: string;
            id: number;
            lat?: number;
            lon?: number;
            center?: { lat: number; lon: number };
            tags?: Record<string, string>;
          }>;
        };
        const out: RawPlace[] = [];
        for (const el of data.elements) {
          const t = el.tags ?? {};
          if (!t.name) continue;
          const lat = el.lat ?? el.center?.lat;
          const lng = el.lon ?? el.center?.lon;
          if (typeof lat !== "number" || typeof lng !== "number") continue;
          const cat = detectCat(t);
          if (!cat) continue;
          out.push({
            osmId: `${el.type}/${el.id}`,
            name: t.name,
            cat,
            lat,
            lng,
            area: t["addr:suburb"] || t["addr:neighbourhood"] || t["addr:city"] || undefined,
            fee: t.fee,
            charge: t.charge,
          });
        }
        return out;
      } catch {
        // try next mirror
      }
    }
    await sleep(2000 * (attempt + 1));
  }
  return [];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function feeFromTags(p: RawPlace): number {
  if (p.charge) {
    const m = p.charge.replace(/,/g, "").match(/\d+(\.\d+)?/);
    if (m) return Math.round(Number(m[0]));
  }
  return 0; // fee=no or unknown → 0 (real fees only; never fabricated)
}

async function run() {
  const { db } = await import("../src/lib/db");
  const { cityPlaces } = await import("../src/lib/db/schema");

  const cols = Math.ceil((BBOX.east - BBOX.west) / STEP);
  const rows = Math.ceil((BBOX.north - BBOX.south) / STEP);
  console.log(`Sweeping Bengaluru in ${rows}×${cols} tiles…`);

  const seen = new Map<string, RawPlace>();
  let tile = 0;
  const total = rows * cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tile++;
      const s = BBOX.south + r * STEP;
      const w = BBOX.west + c * STEP;
      const n = Math.min(BBOX.north, s + STEP);
      const e = Math.min(BBOX.east, w + STEP);
      const places = await fetchTile(s, w, n, e);
      let added = 0;
      for (const p of places) {
        if (!seen.has(p.osmId)) {
          seen.set(p.osmId, p);
          added++;
        }
      }
      console.log(`  tile ${tile}/${total} (+${added}, total ${seen.size})`);
      await sleep(1500);
    }
  }

  const all = [...seen.values()];
  console.log(`\nInserting ${all.length} places into city_places…`);

  const records = all.map((p) => {
    const kind = KIND[p.cat] ?? "attraction";
    const d = DEFAULTS[p.cat] ?? { minutes: 60 };
    const friendly = p.cat.replace(/_/g, " ");
    return {
      slug: `${slugify(p.name)}-${p.osmId.replace("/", "-")}`,
      name: p.name,
      city: "Bengaluru",
      kind,
      category: kind,
      area: p.area ?? null,
      description: `${p.name} is a ${friendly} in Bengaluru, sourced from OpenStreetMap.`,
      shortDescription: `${p.name} — ${friendly}`,
      imageUrl: null,
      entryFeePerPerson: feeFromTags(p),
      avgCostForTwo: d.costForTwo ?? null,
      idealMinutesAtPlace: d.minutes,
      openTime: null,
      closeTime: null,
      openDays: null,
      tags: p.cat,
      latitude: String(p.lat),
      longitude: String(p.lng),
      googlePlaceId: null,
      popularity: 50,
    };
  });

  // Bulk insert in chunks; skip anything already present (by slug).
  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    await db.insert(cityPlaces).values(chunk).onConflictDoNothing({ target: cityPlaces.slug });
    inserted += chunk.length;
    process.stdout.write(`  ${Math.min(inserted, records.length)}/${records.length}\r`);
  }
  console.log(`\nDone. Processed ${records.length} Bengaluru places.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
