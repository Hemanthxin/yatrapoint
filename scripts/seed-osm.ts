// Seed 1000+ REAL places into `city_places` from OpenStreetMap via the Overpass
// API — free, no API key. Run with:  npm run db:seed:osm
//
// It sweeps a grid of centres across Karnataka (Bengaluru metro + Mysuru, Coorg,
// Hampi, Chikmagalur) and pulls named POIs across many categories, then upserts
// them by slug. These places feed the live trip planner (it merges curated
// `city_places` with live Overpass results) and the Explore pages.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// ---- Overpass categories → OSM tag filters (named POIs only) ----
const CATEGORY_FILTERS: Record<string, string[]> = {
  temple: ["amenity=place_of_worship][religion=hindu"],
  church: ["amenity=place_of_worship][religion=christian"],
  mosque: ["amenity=place_of_worship][religion=muslim"],
  museum: ["tourism=museum"],
  park: ["leisure=park"],
  garden: ["leisure=garden"],
  lake: ["natural=water][water=lake", "natural=water][water=reservoir"],
  viewpoint: ["tourism=viewpoint"],
  monument: ["historic=monument", "historic=memorial"],
  fort: ["historic=fort", "historic=castle"],
  tourist_attraction: ["tourism=attraction", "tourism=artwork"],
  restaurant: ["amenity=restaurant"],
  cafe: ["amenity=cafe"],
  nightlife: ["amenity=bar", "amenity=pub", "amenity=nightclub"],
  mall: ["shop=mall"],
  marketplace: ["amenity=marketplace"],
  zoo: ["tourism=zoo"],
  amusement: ["tourism=theme_park", "leisure=water_park"],
};

// Map each OSM category to the `kind` the planner understands (so seeded rows
// are picked up by /api/multi-stop/plan).
const KIND: Record<string, string> = {
  temple: "temple",
  church: "church",
  mosque: "temple",
  museum: "museum",
  park: "park",
  garden: "park",
  lake: "lake",
  viewpoint: "viewpoint",
  monument: "attraction",
  fort: "attraction",
  tourist_attraction: "attraction",
  restaurant: "restaurant",
  cafe: "restaurant",
  nightlife: "nightlife",
  mall: "mall",
  marketplace: "market",
  zoo: "attraction",
  amusement: "attraction",
};

const DEFAULTS: Record<string, { entryFee: number; minutes: number; costForTwo?: number }> = {
  temple: { entryFee: 0, minutes: 30 },
  church: { entryFee: 0, minutes: 30 },
  mosque: { entryFee: 0, minutes: 30 },
  museum: { entryFee: 100, minutes: 90 },
  park: { entryFee: 0, minutes: 60 },
  garden: { entryFee: 50, minutes: 60 },
  lake: { entryFee: 0, minutes: 45 },
  viewpoint: { entryFee: 30, minutes: 45 },
  monument: { entryFee: 25, minutes: 45 },
  fort: { entryFee: 25, minutes: 60 },
  tourist_attraction: { entryFee: 25, minutes: 60 },
  restaurant: { entryFee: 0, minutes: 60, costForTwo: 700 },
  cafe: { entryFee: 0, minutes: 45, costForTwo: 400 },
  nightlife: { entryFee: 0, minutes: 120, costForTwo: 1600 },
  mall: { entryFee: 0, minutes: 90 },
  marketplace: { entryFee: 0, minutes: 45 },
  zoo: { entryFee: 200, minutes: 120 },
  amusement: { entryFee: 500, minutes: 240 },
};

// Centres to sweep: [name, lat, lng, radius_m].
const CENTRES: Array<[string, number, number, number]> = [
  ["Bengaluru-Central", 12.9716, 77.5946, 6000],
  ["Bengaluru-North", 13.0827, 77.5877, 6000],
  ["Bengaluru-South", 12.9081, 77.5712, 6000],
  ["Bengaluru-East", 12.9784, 77.6408, 6000],
  ["Bengaluru-West", 12.9719, 77.5300, 6000],
  ["Bengaluru-Whitefield", 12.9698, 77.7499, 6000],
  ["Bengaluru-Electronic-City", 12.8452, 77.6602, 6000],
  ["Bengaluru-Yelahanka", 13.1007, 77.5963, 6000],
  ["Mysuru", 12.2958, 76.6394, 8000],
  ["Madikeri-Coorg", 12.4244, 75.7382, 12000],
  ["Hampi", 15.335, 76.462, 12000],
  ["Chikmagalur", 13.3161, 75.7720, 12000],
];

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const UA = "YatraPoint/1.0 (https://yatrapoint.local; contact: dev@yatrapoint.local)";

interface RawPlace {
  osmId: string;
  name: string;
  cat: string;
  lat: number;
  lng: number;
  area?: string;
}

function buildQuery(lat: number, lng: number, radius: number): string {
  const around = `around:${radius},${lat},${lng}`;
  const clauses: string[] = [];
  for (const filters of Object.values(CATEGORY_FILTERS)) {
    for (const f of filters) {
      clauses.push(`node[${f}][name](${around});`);
      clauses.push(`way[${f}][name](${around});`);
    }
  }
  return `[out:json][timeout:60];(${clauses.join("")});out tags center 1200;`;
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

async function fetchCentre(lat: number, lng: number, radius: number): Promise<RawPlace[]> {
  const query = buildQuery(lat, lng, radius);
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
        const plat = el.lat ?? el.center?.lat;
        const plng = el.lon ?? el.center?.lon;
        if (typeof plat !== "number" || typeof plng !== "number") continue;
        const cat = detectCat(t);
        if (!cat) continue;
        out.push({
          osmId: `${el.type}/${el.id}`,
          name: t.name,
          cat,
          lat: plat,
          lng: plng,
          area: t["addr:suburb"] || t["addr:city"] || undefined,
        });
      }
      return out;
    } catch {
      // try next mirror
    }
  }
  return [];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

async function run() {
  const { db } = await import("../src/lib/db");
  const { cityPlaces } = await import("../src/lib/db/schema");

  const seen = new Map<string, RawPlace>();
  for (const [name, lat, lng, radius] of CENTRES) {
    process.stdout.write(`Fetching ${name}… `);
    const places = await fetchCentre(lat, lng, radius);
    let added = 0;
    for (const p of places) {
      if (!seen.has(p.osmId)) {
        seen.set(p.osmId, p);
        added++;
      }
    }
    console.log(`+${added} (total ${seen.size})`);
    // be gentle with the public mirrors
    await new Promise((r) => setTimeout(r, 1200));
  }

  const all = [...seen.values()];
  console.log(`\nUpserting ${all.length} places into city_places…`);

  let n = 0;
  for (const p of all) {
    const kind = KIND[p.cat] ?? "attraction";
    const d = DEFAULTS[p.cat] ?? { entryFee: 0, minutes: 60 };
    const slug = `${slugify(p.name)}-${p.osmId.replace("/", "-")}`;
    const friendly = p.cat.replace(/_/g, " ");
    const row = {
      slug,
      name: p.name,
      city: "Karnataka",
      kind,
      category: kind,
      area: p.area ?? null,
      description: `${p.name} is a ${friendly} in Karnataka, sourced from OpenStreetMap.`,
      shortDescription: `${p.name} — ${friendly}`,
      imageUrl: null,
      entryFeePerPerson: d.entryFee,
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
    await db
      .insert(cityPlaces)
      .values(row)
      .onConflictDoUpdate({
        target: cityPlaces.slug,
        set: { name: row.name, kind: row.kind, category: row.category, latitude: row.latitude, longitude: row.longitude },
      });
    n++;
    if (n % 50 === 0) process.stdout.write(`${n}…`);
  }
  console.log(`\nDone. Upserted ${n} places.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
