// Overpass API client — free live OSM data, no API key.
// Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
//
// We map our user-facing categories to OSM tag filters. Each category may
// match multiple tags (e.g. "nightlife" = bar OR pub OR biergarten).

import type { LatLng } from "./geo";

// Overpass requires an identifying User-Agent (it returns 406 without one).
// We rotate through a few mirrors so one being down/over-quota doesn't kill
// the feature.
const USER_AGENT =
  "YatraPoint/1.0 (https://yatrapoint.local; contact: dev@yatrapoint.local)";

const ENDPOINTS: string[] = (() => {
  const envEndpoint = process.env.OVERPASS_URL;
  if (envEndpoint) return [envEndpoint];
  return [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
})();

export type OverpassCategory =
  | "restaurant"
  | "cafe"
  | "nightlife"
  | "fast_food"
  | "mall"
  | "marketplace"
  | "temple"
  | "church"
  | "mosque"
  | "gurudwara"
  | "place_of_worship"
  | "park"
  | "garden"
  | "museum"
  | "viewpoint"
  | "monument"
  | "fort"
  | "lake"
  | "tourist_attraction"
  | "cinema"
  | "theatre"
  | "zoo"
  | "amusement";

// OSM tag filters per category. Each entry is `tag_key=tag_value`.
// We also add a top-level filter for `name` because unnamed POIs are noise.
const CATEGORY_FILTERS: Record<OverpassCategory, string[]> = {
  restaurant: ['amenity=restaurant'],
  cafe: ['amenity=cafe'],
  fast_food: ['amenity=fast_food'],
  nightlife: ['amenity=bar', 'amenity=pub', 'amenity=biergarten', 'amenity=nightclub'],
  mall: ['shop=mall'],
  marketplace: ['amenity=marketplace'],
  temple: ['amenity=place_of_worship][religion=hindu'],
  church: ['amenity=place_of_worship][religion=christian'],
  mosque: ['amenity=place_of_worship][religion=muslim'],
  gurudwara: ['amenity=place_of_worship][religion=sikh'],
  place_of_worship: ['amenity=place_of_worship'],
  park: ['leisure=park'],
  garden: ['leisure=garden'],
  museum: ['tourism=museum'],
  viewpoint: ['tourism=viewpoint'],
  monument: ['historic=monument', 'historic=memorial'],
  fort: ['historic=fort', 'historic=castle'],
  lake: ['natural=water][water=lake', 'natural=water][water=reservoir'],
  tourist_attraction: ['tourism=attraction', 'tourism=artwork'],
  cinema: ['amenity=cinema'],
  theatre: ['amenity=theatre'],
  zoo: ['tourism=zoo'],
  amusement: ['tourism=theme_park', 'leisure=water_park'],
};

export interface OverpassPlace {
  osmId: string; // e.g. "node/12345"
  name: string;
  category: OverpassCategory;
  lat: number;
  lng: number;
  // Raw OSM tags we care about. Most are optional.
  tags: {
    cuisine?: string;
    openingHours?: string;
    website?: string;
    phone?: string;
    addrFull?: string;
    wheelchair?: string;
    religion?: string;
    operator?: string;
    brand?: string;
  };
}

// Default radius for nearby queries.
export const DEFAULT_RADIUS_M = 1500;

// Build an Overpass QL query for one OR more categories within `radius` of
// `centre`. `out center` collapses ways/relations to a single coord.
function buildQuery(
  centre: LatLng,
  radius: number,
  categories: OverpassCategory[],
  cap = 60
): string {
  const around = `around:${radius},${centre.lat},${centre.lng}`;

  const clauses: string[] = [];
  for (const cat of categories) {
    const filters = CATEGORY_FILTERS[cat];
    for (const f of filters) {
      // node + way + relation, plus require a name tag.
      clauses.push(`node[${f}][name](${around});`);
      clauses.push(`way[${f}][name](${around});`);
      clauses.push(`relation[${f}][name](${around});`);
    }
  }

  return `[out:json][timeout:25];(${clauses.join("")});out tags center ${cap};`;
}

interface OverpassResponse {
  elements: Array<{
    type: "node" | "way" | "relation";
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }>;
}

// Light in-process memo to avoid hitting Overpass for the same query twice
// in a row. Keyed by the query body; 5-min TTL.
const cache = new Map<string, { at: number; value: OverpassPlace[] }>();
const CACHE_TTL_MS = 5 * 60_000;

export interface FetchOptions {
  centre: LatLng;
  radius?: number; // metres; default DEFAULT_RADIUS_M
  categories: OverpassCategory[];
  signal?: AbortSignal;
  // Cap results returned to the client (in addition to Overpass's own cap).
  limit?: number;
  // Max elements Overpass itself returns. Higher = more candidate diversity for
  // trip planning. Default 60 keeps nearby/explore queries snappy.
  cap?: number;
}

export async function fetchOverpassPlaces(
  opts: FetchOptions
): Promise<OverpassPlace[]> {
  const { centre, categories, signal } = opts;
  const radius = opts.radius ?? DEFAULT_RADIUS_M;
  const limit = opts.limit ?? 80;
  const query = buildQuery(centre, radius, categories, opts.cap ?? 60);

  const now = Date.now();
  const hit = cache.get(query);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return hit.value.slice(0, limit);
  }

  // Try each mirror in order; the first 2xx wins. Most failures are 429
  // (over-quota) or 504 (timeout) on the public demo — both signals to fall
  // through to the next mirror.
  let data: OverpassResponse | null = null;
  const errors: string[] = [];
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
        signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        errors.push(
          `${endpoint} → ${res.status}${body ? " " + body.slice(0, 100) : ""}`
        );
        continue;
      }
      data = await res.json();
      break;
    } catch (err) {
      errors.push(`${endpoint} → ${err instanceof Error ? err.message : "error"}`);
    }
  }
  if (!data) {
    throw new Error(`All Overpass mirrors failed: ${errors.join("; ")}`);
  }

  const matchesCategory = (
    tags: Record<string, string>,
    cat: OverpassCategory
  ): boolean => {
    return CATEGORY_FILTERS[cat].some((f) => {
      // f is like "amenity=restaurant" or "amenity=place_of_worship][religion=hindu"
      return f.split("][").every((part) => {
        const [k, v] = part.split("=");
        return tags[k] === v;
      });
    });
  };

  const places: OverpassPlace[] = [];
  for (const el of data.elements) {
    const t = el.tags ?? {};
    if (!t.name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;

    const detectedCat =
      categories.find((c) => matchesCategory(t, c)) ?? categories[0];

    places.push({
      osmId: `${el.type}/${el.id}`,
      name: t.name,
      category: detectedCat,
      lat,
      lng,
      tags: {
        cuisine: t.cuisine,
        openingHours: t.opening_hours,
        website: t.website ?? t["contact:website"],
        phone: t.phone ?? t["contact:phone"],
        addrFull: [t["addr:housenumber"], t["addr:street"], t["addr:suburb"], t["addr:city"]]
          .filter(Boolean)
          .join(", ") || undefined,
        wheelchair: t.wheelchair,
        religion: t.religion,
        operator: t.operator,
        brand: t.brand,
      },
    });
  }

  // De-dup by osmId.
  const dedup = new Map<string, OverpassPlace>();
  for (const p of places) dedup.set(p.osmId, p);
  const out = [...dedup.values()];

  cache.set(query, { at: now, value: out });
  if (cache.size > 50) {
    // Trim oldest.
    const oldestKey = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldestKey) cache.delete(oldestKey);
  }

  return out.slice(0, limit);
}
