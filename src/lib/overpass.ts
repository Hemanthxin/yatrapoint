// Overpass API client — free live OSM data, no API key.
// Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
//
// We map our user-facing categories to OSM tag filters. Each category may
// match multiple tags (e.g. "nightlife" = bar OR pub OR biergarten).

import { haversineKm, type LatLng } from "./geo";

// Overpass requires an identifying User-Agent (it returns 406 without one).
// We rotate through a few mirrors so one being down/over-quota doesn't kill
// the feature.
const USER_AGENT =
  "YatraPoint/1.0 (https://yatrapoint.local; contact: dev@yatrapoint.local)";

const ENDPOINTS: string[] = (() => {
  const envEndpoint = process.env.OVERPASS_URL;
  if (envEndpoint) return [envEndpoint];
  // overpass.osm.ch is deliberately ABSENT. It is a Swiss regional extract,
  // not a planet mirror: it answers any Indian query with HTTP 200 and an
  // empty `elements` array, in ~700ms — faster than the mirrors that hold the
  // data. While it was in this list it won every race, and every OSM-backed
  // feature in the app silently showed nothing.
  return [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
  ];
})();

// POST an Overpass query to ALL mirrors AT ONCE and return the first that
// answers with 2xx JSON. Racing beats the old sequential fallback: Overpass
// queries can take 10–20s under load, and trying mirrors one-by-one with a
// short client timeout made every mirror "abort" before any could reply. In
// parallel, the fastest healthy mirror wins in a second or two; the losers are
// cancelled. Each mirror has its own timeout so a single hung mirror can't stall
// the race. Throws with all mirror errors only if every mirror fails.
async function raceOverpass<T = OverpassResponse>(
  query: string,
  signal?: AbortSignal,
  timeoutMs = 25_000
): Promise<T> {
  const master = new AbortController();
  const onOuterAbort = () => master.abort();
  if (signal) {
    if (signal.aborted) master.abort();
    else signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  const attempt = async (endpoint: string): Promise<T> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const linkMaster = () => ctrl.abort();
    master.signal.addEventListener("abort", linkMaster, { once: true });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${endpoint} → ${res.status}${body ? " " + body.slice(0, 80) : ""}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
      master.signal.removeEventListener("abort", linkMaster);
    }
  };

  // Take the first mirror that answers WITH DATA, not merely the first that
  // answers 2xx.
  //
  // Promise.any resolved on the first success, and one mirror
  // (overpass.osm.ch) returns HTTP 200 with an empty `elements` array in about
  // 700 ms — faster than the mirror that actually answers. It won every race,
  // so every Overpass-backed feature in the app silently showed nothing: the
  // Food and Shopping lists on a place, live places in Explore, the planner's
  // live discovery, and the OSM half of "Near you". Nothing errored, because
  // an empty result is a legitimate answer to "what is near here" — it just
  // was not the truth.
  //
  // An empty response is still kept as a fallback, so a genuinely empty area
  // resolves normally once every mirror has had its say.
  const hasData = (d: unknown): boolean => {
    const els = (d as { elements?: unknown[] } | null)?.elements;
    return Array.isArray(els) ? els.length > 0 : true; // non-element payloads pass
  };

  try {
    return await new Promise<T>((resolve, reject) => {
      let pending = ENDPOINTS.length;
      let empty: T | null = null;
      const errors: string[] = [];

      for (const endpoint of ENDPOINTS) {
        attempt(endpoint).then(
          (data) => {
            if (hasData(data)) {
              master.abort(); // cancel the slower mirrors
              resolve(data);
              return;
            }
            if (empty === null) empty = data;
            if (--pending === 0) {
              if (empty !== null) resolve(empty);
              else reject(new Error(`All Overpass mirrors failed: ${errors.join("; ")}`));
            }
          },
          (err) => {
            errors.push(err instanceof Error ? err.message : String(err));
            if (--pending === 0) {
              if (empty !== null) resolve(empty);
              else reject(new Error(`All Overpass mirrors failed: ${errors.join("; ")}`));
            }
          }
        );
      }
    });
  } finally {
    if (signal) signal.removeEventListener("abort", onOuterAbort);
  }
}

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
  | "amusement"
  | "station";

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
  station: ['railway=station', 'railway=halt'],
};

// Raw Overpass element — used by generic queries (e.g. admin boundaries).
export interface OverpassElement {
  type: "node" | "way" | "relation" | "area";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// Run an arbitrary Overpass QL query against the mirror pool and return the raw
// elements. Shares the User-Agent + multi-mirror fallback used everywhere else.
export async function runOverpassQuery(
  ql: string,
  signal?: AbortSignal
): Promise<OverpassElement[]> {
  const data = await raceOverpass<{ elements?: OverpassElement[] }>(ql, signal);
  return data.elements ?? [];
}

export interface NearestStation {
  name: string;
  lat: number;
  lng: number;
  km: number; // straight-line distance from the query centre
  halt: boolean; // true = minor halt, false = full station
}

// Nearest railway station/halt to a point (for TRAIN-mode "board here / alight
// there" guidance). Prefers a full station over a halt when both are close.
export async function findNearestStation(
  centre: LatLng,
  radiusKm = 45
): Promise<NearestStation | null> {
  const around = `around:${Math.round(radiusKm * 1000)},${centre.lat},${centre.lng}`;
  const q = `[out:json][timeout:20];(node[railway~"^(station|halt)$"][name](${around});way[railway~"^(station|halt)$"][name](${around}););out center 80;`;
  let els;
  try {
    els = await runOverpassQuery(q);
  } catch {
    return null;
  }
  const found: NearestStation[] = [];
  for (const e of els) {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const name = e.tags?.name?.trim();
    if (typeof lat !== "number" || typeof lng !== "number" || !name) continue;
    found.push({ name, lat, lng, km: haversineKm(centre, { lat, lng }), halt: e.tags?.railway === "halt" });
  }
  if (found.length === 0) return null;
  found.sort((a, b) => a.km - b.km);
  // Prefer a full station if one is within ~1.4× the nearest halt's distance.
  const nearest = found[0];
  if (nearest.halt) {
    const station = found.find((f) => !f.halt);
    if (station && station.km <= nearest.km * 1.4) return station;
  }
  return nearest;
}

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
    // Real entry-fee signals from OSM. `fee` is "yes"/"no"; `charge` is the
    // actual amount when mapped, e.g. "20 INR" / "₹50".
    fee?: string;
    charge?: string;
    // Photo signals (BUG-03). OSM contributors tag many notable places with a
    // picture, and these particular tags point at freely-licensed material we
    // may legally use: `image` is a direct URL, `wikimedia_commons` names a
    // Commons file/category, and `wikipedia` is a "lang:Title" article
    // reference. See placePhotoFromTags() below.
    image?: string;
    wikimediaCommons?: string;
    wikipedia?: string;
  };
  // A ready-to-use photo URL derived from the tags above, or null when the
  // place carries no usable photo reference.
  imageUrl: string | null;
}

// Turn OSM's photo tags into a URL we can render.
//
// BUG-03: live-API places always came back with no photo at all, so every one
// of them fell through to a plain coloured tile. OSM's own tags are the
// reliable, licence-safe source for these: Wikimedia Commons content is
// freely licensed, and Special:FilePath resolves a file name to the image
// (`width` asks Commons to serve a thumbnail rather than a full-size original).
// A place with none of these tags still returns null — the caller then falls
// back to a name-matched Wikipedia lookup, and finally to the gradient tile.
export function placePhotoFromTags(tags: {
  image?: string;
  wikimediaCommons?: string;
}): string | null {
  // A direct image URL, but only over https and only from hosts that actually
  // serve images — an http URL would be blocked as mixed content, and a link
  // to some random page isn't a photo.
  const direct = tags.image?.trim();
  if (direct && /^https:\/\//i.test(direct) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(direct)) {
    return direct;
  }

  // "File:Foo.jpg" (a single file) — a "Category:..." value names a gallery
  // rather than one image, so it is not usable directly.
  const commons = tags.wikimediaCommons?.trim();
  if (commons && /^file:/i.test(commons)) {
    const file = commons.replace(/^file:/i, "").trim();
    if (file) {
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;
    }
  }

  return null;
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
      // node + way only (both require a name). Relations are dropped: they're
      // rarely a single POI and roughly triple the query cost, which is what
      // pushes the public mirrors into 504/timeout. `nwr` isn't used because the
      // per-type form lets Overpass short-circuit faster.
      clauses.push(`node[${f}][name](${around});`);
      clauses.push(`way[${f}][name](${around});`);
    }
  }

  return `[out:json][timeout:20];(${clauses.join("")});out tags center ${cap};`;
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

// Junk names we never want as trip stops (schools, civic infra, transit, etc.).
const NAME_BLOCKLIST =
  /\b(school|college|university|institute|coaching|tuition|hospital|clinic|nursing\s*home|pharmacy|medical|police|fire\s*station|petrol|fuel|bunk|atm|bank|hostel|\bpg\b|paying\s*guest|apartment|layout|society|bus\s*(stop|stand|station)|metro\s*station|railway|godown|warehouse|office|ward|substation|water\s*tank|sewage|toilet|parking|showroom|service\s*cent|workshop|factory|company|pvt\s*ltd)\b/i;

// True only if a place is something a traveller would actually visit — not
// closed, disused, or civic/transit infrastructure.
function isVisitable(t: Record<string, string>): boolean {
  if (!t.name) return false;
  // Railway stations/halts are legitimate stops for TRAIN-mode trips — allow a
  // named one through even though its name may contain "station"/"railway".
  if (t.railway === "station" || t.railway === "halt") return true;
  // Permanently closed / disused / abandoned (any lifecycle-prefixed tag).
  for (const k of Object.keys(t)) {
    if (/^(disused|abandoned|was|razed|demolished|removed|construction|proposed):/i.test(k)) return false;
  }
  if (t.opening_hours && /^(closed|off)$/i.test(t.opening_hours.trim())) return false;
  if (t["disused"] === "yes" || t["abandoned"] === "yes") return false;
  // Non-visitable amenities even if they slipped through a category filter.
  const amen = t.amenity ?? "";
  if (/^(school|college|university|kindergarten|hospital|clinic|fuel|bank|atm|pharmacy|police|fire_station|townhall|courthouse|prison|fuel|driving_school|language_school|childcare)$/.test(amen))
    return false;
  if (NAME_BLOCKLIST.test(t.name)) return false;
  return true;
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

  // Race all mirrors in parallel — the first healthy one wins, so a slow or
  // down mirror can't make the whole query time out.
  const data = await raceOverpass<OverpassResponse>(query, signal);

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
    if (!isVisitable(t)) continue; // drop closed / disused / non-tourist POIs

    const detectedCat =
      categories.find((c) => matchesCategory(t, c)) ?? categories[0];

    const placeTags = {
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
      fee: t.fee,
      charge: t.charge,
      image: t.image,
      wikimediaCommons: t.wikimedia_commons,
      wikipedia: t.wikipedia,
    };

    places.push({
      osmId: `${el.type}/${el.id}`,
      name: t.name,
      category: detectedCat,
      lat,
      lng,
      tags: placeTags,
      imageUrl: placePhotoFromTags(placeTags),
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
