import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cityPlaces, destinations, nearbyDestinations } from "@/lib/db/schema";
import { fetchOverpassPlaces, findNearestStation, type OverpassCategory } from "@/lib/overpass";
import { fetchRoute } from "@/lib/routing";
import { destinationPoint, haversineKm } from "@/lib/geo";
import {
  CATEGORY_DEFAULTS,
  candidateFromOverpass,
  planMultiStop,
  type Candidate,
} from "@/lib/multi-stop";
import { VEHICLES, type VehicleKind } from "@/lib/budget";
import {
  travelCostFor,
  isBengaluru,
  FLIGHT_PER_KM,
  FLIGHT_BASE,
  type TravelMode,
} from "@/lib/transport";

export const runtime = "nodejs";
// Plan generation fans out to Overpass (mirror race) + OSRM + DB; give it room.
export const maxDuration = 60;

const ALL_OVERPASS: OverpassCategory[] = [
  "restaurant",
  "cafe",
  "fast_food",
  "nightlife",
  "mall",
  "marketplace",
  "temple",
  "church",
  "mosque",
  "gurudwara",
  "place_of_worship",
  "park",
  "garden",
  "museum",
  "viewpoint",
  "monument",
  "fort",
  "lake",
  "tourist_attraction",
  "cinema",
  "theatre",
  "zoo",
  "amusement",
  "station",
];

const VEHICLE_KINDS = Object.keys(VEHICLES) as VehicleKind[];

// Names that aren't real trip stops (schools, civic infra, transit, courts,
// govt offices, etc.) — filters junk out of both seeded and live candidates.
const JUNK_NAME =
  /\b(school|college|university|institute|coaching|tuition|hospital|clinic|nursing\s*home|pharmacy|medical|police|fire\s*station|petrol|fuel|bunk|atm|bank|hostel|\bpg\b|paying\s*guest|apartment|layout|society|bus\s*(stop|stand|station)|metro\s*station|railway|godown|warehouse|\boffice\b|ward|substation|water\s*tank|sewage|toilet|parking|showroom|service\s*cent|workshop|factory|company|pvt\s*ltd|high\s*court|district\s*court|sessions\s*court|civil\s*court|family\s*court|courthouse|kacheri|secretariat|collectorate|tahsildar|municipal\s*corporation|city\s*corporation|\brto\b|passport\s*seva)\b/i;

// Infer the actual place-of-worship type from a name, so a mosque/church/
// gurudwara that was bulk-seeded under a generic "temple" kind (or sits in the
// broad "pilgrimage" catalogue category) is shown — and filtered — correctly.
// Returns null when the name gives no signal.
function worshipKind(name: string): OverpassCategory | null {
  const n = name.toLowerCase();
  if (/\b(masjid|mosque|dargah|durgah|jama|idgah|khanqah|ashurkhana)\b/.test(n)) return "mosque";
  if (/\b(church|cathedral|chapel|basilica|methodist|baptist|c\.?s\.?i\.?)\b/.test(n)) return "church";
  if (/\b(gurudwara|gurdwara|gurd?wara|sahib|singh\s*sabha)\b/.test(n)) return "gurudwara";
  if (/\b(temple|mandir|mandira|devasthana|devalaya|kovil|koil|gudi|matha|math|swamy|swami|devi|amma|eshwara|eshwar|ishwara|linga|vinayaka|ganapathi|ganesha|anjaneya|hanuman|venkat|narasimha|krishna|shiva|vishnu|rama|durga|kali|basadi|basti)\b/.test(n)) return "temple";
  return null;
}

const bodySchema = z.object({
  start: z.object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  }),
  // Centre used to DISCOVER places (the chosen area's centre in area mode). The
  // route still begins at `start`. Defaults to `start` when omitted.
  searchCentre: z
    .object({
      lat: z.number().gte(-90).lte(90),
      lng: z.number().gte(-180).lte(180),
    })
    .optional(),
  totalBudget: z.number().int().min(1).max(2_000_000),
  hours: z.number().min(1).max(120),
  people: z.number().int().min(1).max(20),
  vehicle: z.enum(VEHICLE_KINDS as [VehicleKind, ...VehicleKind[]]),
  // User-facing OSM categories (we accept any of ALL_OVERPASS). Optional when
  // the traveller hand-picks specific places instead of discovering by type.
  categories: z.array(z.string()).default([]),
  // Curated-catalogue place ids the traveller explicitly chose to include.
  includePlaceIds: z.array(z.string()).max(50).default([]),
  includeFood: z.boolean().default(true),
  // Optional user-entered food budget for the WHOLE trip (INR). When provided it
  // replaces the ₹350/person/day estimate as the meals baseline, so travellers
  // control exactly how much food money the plan reserves. Null/absent → estimate.
  foodBudget: z.number().int().min(0).max(1_000_000).nullable().default(null),
  maxStops: z.number().int().min(2).max(15).default(6),
  searchRadiusKm: z.number().min(1).max(500).default(25),
  // "Around me" planning: minimum distance (km) a place must be from the
  // traveller, and the compass direction to head ("any" = full circle).
  minDistanceKm: z.number().min(0).max(500).default(0),
  direction: z.enum(["any", "north", "south", "east", "west"]).default("any"),
  // Area mode: restrict the curated catalogue to these district(s)/taluk so a
  // chosen area only yields places from that area.
  areaDistricts: z.array(z.string()).max(50).default([]),
  // Travel mode — drives the cost model (fuel vs BMTC/train/flight fares) and
  // the map style (road route vs rail line vs flight arc).
  mode: z.enum(["any", "car", "bike", "bus", "train", "flight"]).default("any"),
  // Number of days — used for the nightly stay cost (nights = days − 1).
  days: z.number().int().min(1).max(30).default(1),
  // Ids of stops from a PREVIOUS plan (Regenerate) to steer away from, so the
  // traveller sees a genuinely different set of places when they ask again —
  // not a hard ban (a repeat is still used if nothing else fits the budget/
  // time/distance), just strongly deprioritised.
  excludeIds: z.array(z.string()).max(50).default([]),
});

// Curated `destinations.category` → Overpass category, so hand-picked catalogue
// places slot into the same planner as discovered ones.
const DEST_CATEGORY_TO_OVERPASS: Record<string, OverpassCategory> = {
  Attraction: "tourist_attraction",
  Temple: "temple",
  Waterfall: "tourist_attraction",
  Beach: "tourist_attraction",
  "Hill Station": "viewpoint",
  Museum: "museum",
  Park: "park",
  Restaurant: "restaurant",
  Adventure: "tourist_attraction",
  Heritage: "monument",
  Lake: "lake",
  Market: "marketplace",
  Other: "tourist_attraction",
};

// Map seeded city_places categories to Overpass categories so we can use the
// curated seed alongside live OSM data.
const SEED_KIND_TO_OVERPASS: Record<string, OverpassCategory> = {
  attraction: "tourist_attraction",
  temple: "temple",
  church: "church",
  museum: "museum",
  park: "park",
  lake: "lake",
  restaurant: "restaurant",
  mall: "mall",
  nightlife: "nightlife",
  market: "marketplace",
  viewpoint: "viewpoint",
};

// The statewide `destinations` catalogue uses six broad category slugs. Map each
// to the Overpass categories it can satisfy, so a curated destination is auto-
// discovered whenever the traveller has picked a matching place type — this is
// what makes the planner UNIVERSAL (works anywhere a destination exists, not
// just where there are seeded city places). The first matching wanted category
// becomes the candidate's display category.
// Non-worship catalogue categories. Pilgrimage is handled separately via
// worshipKind() so a mosque/church never surfaces under a "temples" request.
const DEST_CAT_TO_OVERPASS: Record<string, OverpassCategory[]> = {
  heritage: ["monument", "fort", "museum", "tourist_attraction"],
  hill_station: ["viewpoint", "tourist_attraction"],
  adventure: ["viewpoint", "tourist_attraction"],
  beach: ["tourist_attraction"],
  wildlife: ["zoo", "tourist_attraction"],
};

// Worship Overpass categories — used to decide when to pull worship-kind seed
// rows so a misfiled mosque can be re-routed to the correct filter.
const WORSHIP_OPS = new Set<OverpassCategory>([
  "temple",
  "church",
  "mosque",
  "gurudwara",
  "place_of_worship",
]);

// Resolve ANY stored `destinations.category` to the Overpass place-types it can
// satisfy, so a catalogue place is auto-discovered whenever the traveller picks
// a matching place type. Handles all three category vocabularies:
//   • the six broad catalogue slugs (pilgrimage / heritage / hill_station / …),
//   • the ADMIN form's labels (Temple / Museum / Waterfall / Park / Lake / …),
//   • anything else → a generic attraction,
// which is what lets admin-added places show up in generated plans exactly like
// the seeded ones. Worship places keep their by-name routing so a mosque/church
// never surfaces under a "temples" request.
function resolveDestOverpass(category: string, name: string): OverpassCategory[] {
  if (category === "pilgrimage") return [worshipKind(name) ?? "temple"];
  const slugMapped = DEST_CAT_TO_OVERPASS[category];
  if (slugMapped) return slugMapped;
  const adminMapped = DEST_CATEGORY_TO_OVERPASS[category];
  if (adminMapped) {
    return adminMapped === "temple" ? [worshipKind(name) ?? "temple"] : [adminMapped];
  }
  return ["tourist_attraction"];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const wantedCats = parsed.data.categories.filter((c): c is OverpassCategory =>
    (ALL_OVERPASS as string[]).includes(c)
  );
  // Always widen the search to general tourist attractions/heritage spots on
  // top of whatever specific interests the traveller picked — keeps the
  // candidate pool from being too thin to hit the requested stop count when
  // the chosen interests are narrow or the area is sparsely seeded (e.g. a
  // far "around me" search), and travellers expect well-known tourist places
  // to always be considered, not just their exact category picks.
  if (!wantedCats.includes("tourist_attraction")) wantedCats.push("tourist_attraction");
  const mode = parsed.data.mode as TravelMode;
  // In TRAIN mode, also discover railway stations so the actual stations along
  // the trip (e.g. Bangarpet) show up as stops on the map.
  if (mode === "train" && !wantedCats.includes("station")) wantedCats.push("station");
  const placeIds = parsed.data.includePlaceIds;
  if (wantedCats.length === 0 && placeIds.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one place type or one specific place." },
      { status: 400 }
    );
  }

  // Centre + radius that bound where we look for places. Everything except the
  // traveller's hand-picked (pinned) places must fall inside this radius, so the
  // km the user chose genuinely controls how far the trip ranges.
  const searchCentre = parsed.data.searchCentre ?? parsed.data.start;
  const radiusKm = parsed.data.searchRadiusKm;
  const withinRadius = (lat: number, lng: number) =>
    haversineKm(searchCentre, { lat, lng }) <= radiusKm;

  // Direction + minimum-distance gate, measured from the TRAVELLER (start). Only
  // active for "around me" planning; area plans leave these at their defaults.
  // The compass sector is 90° wide centred on the chosen cardinal, so "North"
  // keeps only places roughly north of the traveller.
  const start = parsed.data.start;
  const minDistanceKm = parsed.data.minDistanceKm;
  const direction = parsed.data.direction;
  const SECTOR_HALF = 45; // degrees either side of the cardinal
  const DIR_BEARING: Record<string, number> = { north: 0, east: 90, south: 180, west: 270 };
  const bearingDeg = (from: { lat: number; lng: number }, lat: number, lng: number) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const lat1 = toRad(from.lat);
    const lat2 = toRad(lat);
    const dLng = toRad(lng - from.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180) / Math.PI; // -180..180, 0 = north, 90 = east
  };
  const angDiff = (a: number, b: number) => {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
  };
  // A place passes when it's beyond the minimum distance AND (if a cardinal was
  // chosen) inside that compass sector. Hand-picked pinned places bypass this.
  const passesReach = (lat: number, lng: number) => {
    const dFromMe = haversineKm(start, { lat, lng });
    if (minDistanceKm > 0 && dFromMe < minDistanceKm) return false;
    if (direction !== "any") {
      const target = DIR_BEARING[direction];
      // Very close places have a meaningless bearing — the min-distance gate
      // already handles them; skip the sector test when essentially at origin.
      if (dFromMe > 0.5 && angDiff(bearingDeg(start, lat, lng), target) > SECTOR_HALF)
        return false;
    }
    return true;
  };
  // Combined gate for auto-discovered (non-pinned) candidates.
  const withinReach = (lat: number, lng: number) =>
    withinRadius(lat, lng) && passesReach(lat, lng);

  // Live Overpass is only worth querying for LOCAL density. Two guards keep plan
  // generation fast:
  //   • Cap the query radius at 60 km — an Overpass scan over hundreds of km is
  //     very slow and often times out; far places come from the curated DB
  //     catalogue (already loaded in-memory) instead.
  //   • Skip Overpass entirely once the minimum distance is at or beyond that
  //     60 km cap: everything Overpass could return near the centre would be
  //     filtered out by the min-distance gate anyway, so the call is pure
  //     waste. Below that, there's a real overlap ring (minDistanceKm..60 km)
  //     worth querying — this is what lets the 50-100 km "around me" band
  //     surface genuine live places (and things to actually spend money on)
  //     instead of relying solely on the thin curated catalogue out there.
  const OVERPASS_MAX_KM = 60;
  const overpassRadiusKm = Math.min(radiusKm, OVERPASS_MAX_KM);
  const useOverpass = wantedCats.length > 0 && minDistanceKm < OVERPASS_MAX_KM;

  // Kick the slowest external call (live Overpass) off NOW so it runs in
  // parallel with all the curated DB lookups below — this shaves seconds off
  // plan generation instead of waiting for the DB round-trips first.
  const initialOverpass =
    useOverpass
      ? fetchOverpassPlaces({
          centre: searchCentre,
          categories: wantedCats,
          radius: overpassRadiusKm * 1000,
          limit: 200,
          cap: 200,
        }).then(
          (places) => ({ places, error: null as string | null }),
          (err) => ({ places: [] as Awaited<ReturnType<typeof fetchOverpassPlaces>>, error: err instanceof Error ? err.message : "Overpass failed" })
        )
      : Promise.resolve({ places: [] as Awaited<ReturnType<typeof fetchOverpassPlaces>>, error: null as string | null });

  // De-dup keys. We merge a place if EITHER it's within ~110 m of one already
  // taken, OR it has the same normalised name — so "Royal Meenakshi Mall" from
  // the seed and the same mall from live OSM (mapped a few hundred metres apart)
  // collapse into a single stop instead of appearing twice.
  const coordKey = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  // Word set of a name, for catching "ISKCON Temple" vs "ISKCON Temple Bangalore"
  // — same place re-mapped with an extra word a short distance away.
  const tokensOf = (name: string) =>
    new Set(
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1)
    );
  const isSubset = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((t) => b.has(t));
  // Token overlap ratio (0..1) — catches near-identical names like "Ranganatha
  // Swamy Temple" vs "Sri Ranganathaswamy Temple" that share most words.
  const jaccard = (a: Set<string>, b: Set<string>) => {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / (a.size + b.size - inter);
  };

  // 0) Hand-picked catalogue places — pinned so the planner pulls them in first.
  const pinnedCandidates: Candidate[] = [];
  if (placeIds.length > 0) {
    const picked = await db
      .select()
      .from(destinations)
      .where(inArray(destinations.id, placeIds));
    for (const d of picked) {
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const op = resolveDestOverpass(d.category, d.name)[0];
      pinnedCandidates.push({
        id: `dest:${d.id}`,
        name: d.name,
        category: op,
        lat,
        lng,
        entryFee: d.entryFees,
        entryFeeKnown: true,
        idealMinutes: CATEGORY_DEFAULTS[op].idealMinutes,
        popularity: 100,
        pinned: true,
        imageUrl: d.imageUrl,
        meta: { citySeedSlug: d.slug },
      });
    }
  }

  // The real Overpass category for a seed row: for worship kinds, re-derive the
  // actual religion-specific type from the name (the bulk OSM seed filed every
  // place of worship under "temple"), so masjids/churches are labelled — and
  // filtered — correctly.
  const effectiveSeedCat = (kind: string, name: string): OverpassCategory | null => {
    const base = SEED_KIND_TO_OVERPASS[kind];
    if (!base) return null;
    return WORSHIP_OPS.has(base) ? (worshipKind(name) ?? base) : base;
  };

  // 1) Curated seed places that match the wanted categories. When ANY worship
  // type is wanted we also pull the worship-kind rows (temple/church) so a
  // mis-filed mosque can be re-routed to the right filter by effectiveSeedCat.
  const wantsWorship = wantedCats.some((c) => WORSHIP_OPS.has(c));
  const seedKinds = Object.entries(SEED_KIND_TO_OVERPASS)
    .filter(([, op]) => wantedCats.includes(op) || (wantsWorship && WORSHIP_OPS.has(op)))
    .map(([k]) => k);
  const seedMatches =
    seedKinds.length > 0
      ? await db.select().from(cityPlaces).where(inArray(cityPlaces.kind, seedKinds))
      : [];

  const seedCandidates: Candidate[] = seedMatches
    .filter((s) => {
      const op = effectiveSeedCat(s.kind, s.name);
      if (!op || !wantedCats.includes(op) || JUNK_NAME.test(s.name)) return false;
      // Honour the chosen radius, minimum distance and direction — don't let the
      // whole curated city catalogue leak in regardless of where the traveller
      // wants to roam.
      return withinReach(Number(s.latitude), Number(s.longitude));
    })
    .map((s) => {
      const op = effectiveSeedCat(s.kind, s.name) ?? "tourist_attraction";
      // Bulk OSM-seeded rows (slug ends in -node-/-way-/-relation-) carry
      // generic category fees — not real. Only genuinely curated seed rows
      // have trustworthy per-place fees.
      const isOsmSeed = /-(node|way|relation)-\d+$/i.test(s.slug);
      return {
        id: `seed:${s.id}`,
        name: s.name,
        category: op,
        lat: Number(s.latitude),
        lng: Number(s.longitude),
        // Curated rows have a real fee; bulk OSM-seeded rows get a realistic
        // category estimate (flagged as an estimate) so the total isn't ₹0.
        entryFee: isOsmSeed ? CATEGORY_DEFAULTS[op].entryFee : s.entryFeePerPerson,
        entryFeeKnown: !isOsmSeed,
        idealMinutes: s.idealMinutesAtPlace,
        foodCostPerPerson:
          s.avgCostForTwo != null ? Math.round(s.avgCostForTwo / 2) : undefined,
        popularity: s.popularity,
        imageUrl: s.imageUrl,
        meta: { citySeedSlug: s.slug },
      };
    });

  // 1b) The statewide curated catalogue — EVERY destination in the database that
  // falls within the search radius and matches a wanted category. This is the
  // universal source: it makes the planner work anywhere in the catalogue, not
  // just where seeded city places exist. (Hand-picked ones are already pinned
  // above; coordinate de-dup in addCandidate stops doubles.)
  // When the traveller chose a specific district/taluk, keep only catalogue
  // places from that district — otherwise nearby districts leak in via radius.
  const normDist = (s: string) => s.toLowerCase().replace(/\b(district|rural|urban|taluk[au]?|tehsil)\b/g, "").replace(/[^a-z0-9]/g, "");
  const wantedDistricts = parsed.data.areaDistricts.map(normDist).filter(Boolean);
  const matchesArea = (district: string | null) => {
    if (wantedDistricts.length === 0) return true;
    if (!district) return false;
    const n = normDist(district);
    return wantedDistricts.some((w) => n === w || n.startsWith(w) || w.startsWith(n));
  };

  const allDestinations = await db.select().from(destinations);
  const destCandidates: Candidate[] = [];
  for (const d of allDestinations) {
    const lat = Number(d.latitude);
    const lng = Number(d.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (JUNK_NAME.test(d.name)) continue;
    if (!withinReach(lat, lng)) continue;
    if (!matchesArea(d.district)) continue;
    // Resolve the category across catalogue slugs AND admin-form labels, so
    // admin-added places (category "Temple", "Museum", …) are discovered under
    // the right place type instead of being silently dropped.
    const ops = resolveDestOverpass(d.category, d.name);
    const matched = ops.filter((c) => wantedCats.includes(c));
    if (matched.length === 0) continue;
    const op: OverpassCategory = matched[0];
    destCandidates.push({
      id: `dest:${d.id}`,
      name: d.name,
      category: op,
      lat,
      lng,
      entryFee: d.entryFees,
      entryFeeKnown: true,
      idealMinutes: CATEGORY_DEFAULTS[op].idealMinutes,
      popularity: d.popularity,
      imageUrl: d.imageUrl,
      meta: { citySeedSlug: d.slug },
    });
  }

  // 1c) One-day-trip catalogue (`nearby_destinations`) — day-trip spots that
  // aren't in the statewide `destinations` table. They use the same broad
  // category slugs (heritage / hill_station / adventure / wildlife / pilgrimage)
  // so resolveDestOverpass maps them identically. Included so EVERY curated place
  // table feeds the planner, not just destinations + city_places.
  const allNearby = await db.select().from(nearbyDestinations);
  const nearbyCandidates: Candidate[] = [];
  for (const n of allNearby) {
    const lat = Number(n.latitude);
    const lng = Number(n.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (JUNK_NAME.test(n.name)) continue;
    if (!withinReach(lat, lng)) continue;
    const ops = resolveDestOverpass(n.category, n.name);
    const matched = ops.filter((c) => wantedCats.includes(c));
    if (matched.length === 0) continue;
    const op: OverpassCategory = matched[0];
    nearbyCandidates.push({
      id: `nearby:${n.id}`,
      name: n.name,
      category: op,
      lat,
      lng,
      entryFee: n.entryFeePerPerson,
      entryFeeKnown: true,
      // Stored in HOURS at the spot; the planner works in minutes.
      idealMinutes: Math.max(15, Math.round(n.idealHoursAtPlace * 60)),
      popularity: n.popularity,
      imageUrl: n.imageUrl,
      meta: { citySeedSlug: n.slug },
    });
  }

  // 2) Live Overpass candidates, merged + de-duped. Auto-widen the radius when
  // the area is sparse so we can reliably reach the requested number of places.
  const finalCandidates: Candidate[] = [];
  const usedKeys = new Set<string>();
  const usedNames = new Set<string>();
  const placedTokens: Array<{ tokens: Set<string>; lat: number; lng: number }> = [];
  // Add a candidate unless it's a duplicate of one already taken: same ~110 m
  // spot, same normalised name, OR a name whose words are a subset/superset of a
  // VERY nearby place's (≤600 m — i.e. the same complex mapped twice, like
  // "ISKCON Temple" and "ISKCON Temple Bangalore"). Kept tight so genuinely
  // different places that merely share a word aren't wrongly merged. Pinned →
  // seed → Overpass order means the richest source wins.
  const addCandidate = (c: Candidate): boolean => {
    const ck = coordKey(c.lat, c.lng);
    const nk = nameKey(c.name);
    if (usedKeys.has(ck) || (nk && usedNames.has(nk))) return false;
    const tk = tokensOf(c.name);
    for (const p of placedTokens) {
      const gapKm = haversineKm({ lat: c.lat, lng: c.lng }, { lat: p.lat, lng: p.lng });
      // Same complex mapped twice: one name's words are a subset of the other's
      // and they sit close together (≤1.2 km).
      if (gapKm <= 1.2 && (isSubset(tk, p.tokens) || isSubset(p.tokens, tk))) return false;
      // Near-identical names (≥70% token overlap) a short distance apart (≤2 km)
      // — the same place from two data sources with slightly different spellings.
      if (gapKm <= 2 && jaccard(tk, p.tokens) >= 0.7) return false;
    }
    usedKeys.add(ck);
    if (nk) usedNames.add(nk);
    placedTokens.push({ tokens: tk, lat: c.lat, lng: c.lng });
    finalCandidates.push(c);
    return true;
  };
  for (const c of pinnedCandidates) addCandidate(c);
  for (const c of seedCandidates) addCandidate(c);
  // Sort the curated catalogue by popularity so the best-known places win the
  // de-dup race against generic OSM points at the same spot.
  destCandidates.sort((a, b) => (b.popularity ?? 50) - (a.popularity ?? 50));
  for (const c of destCandidates) addCandidate(c);
  // One-day-trip catalogue, also popularity-first so well-known day trips win
  // the de-dup race against generic OSM points at the same spot.
  nearbyCandidates.sort((a, b) => (b.popularity ?? 50) - (a.popularity ?? 50));
  for (const c of nearbyCandidates) addCandidate(c);

  let overpassCount = 0;
  let overpassError: string | null = null;

  const ingestOverpass = (places: Awaited<ReturnType<typeof fetchOverpassPlaces>>) => {
    overpassCount += places.length;
    for (const op of places) {
      // Railway stations legitimately contain "station"/"railway" in the name —
      // don't junk-filter them (they're wanted in train mode).
      if (op.category !== "station" && JUNK_NAME.test(op.name)) continue;
      // Honour the minimum distance + direction (radius is already applied by
      // the Overpass fetch). Stations bypass so train-mode routing still works.
      if (op.category !== "station" && !passesReach(op.lat, op.lng)) continue;
      addCandidate(candidateFromOverpass(op));
    }
  };

  const addOverpass = async (km: number) => {
    const places = await fetchOverpassPlaces({
      centre: searchCentre,
      categories: wantedCats,
      radius: km * 1000,
      limit: 200,
      cap: 200,
    });
    ingestOverpass(places);
  };

  let currentKm = overpassRadiusKm;
  // The initial fetch was already started in parallel with the DB queries.
  const first = await initialOverpass;
  if (first.error) overpassError = first.error;
  else ingestOverpass(first.places);

  // Sparse-area safety net: only if Overpass was used and returned almost
  // nothing, widen its (capped) radius by 20% once. Never for far outstation
  // bands, which don't use Overpass at all.
  if (useOverpass && finalCandidates.length < 2 && !overpassError) {
    currentKm = Math.min(OVERPASS_MAX_KM, overpassRadiusKm * 1.2);
    try {
      await addOverpass(currentKm);
    } catch {
      /* keep what we have */
    }
  }

  // Far-directional safety net: bands with minDistanceKm >= OVERPASS_MAX_KM
  // skip the near-field Overpass fetch above entirely (anything it could find
  // within OVERPASS_MAX_KM of the traveller would fail the min-distance filter
  // anyway), so those bands rely solely on the curated catalogue. That
  // catalogue's coverage is uneven — dense in some corridors, thin in a
  // specific 90° compass sector — so a request like "100-200 km East" can
  // turn up only a handful of real candidates even where "any direction"
  // would have plenty. When that happens, run live Overpass discovery
  // centred on a few points ALONG the chosen bearing (not the traveller's own
  // location), spread across the requested band, so real OSM places out
  // there get a chance to fill the pool too.
  const maxStopsRequested = parsed.data.maxStops;
  if (
    minDistanceKm >= OVERPASS_MAX_KM &&
    direction !== "any" &&
    wantedCats.length > 0 &&
    finalCandidates.length < Math.max(20, maxStopsRequested * 2)
  ) {
    const bearing = DIR_BEARING[direction];
    const bandWidthKm = Math.max(0, radiusKm - minDistanceKm);
    const sampleRadiusKm = Math.min(OVERPASS_MAX_KM, Math.max(30, bandWidthKm / 2 + 20));
    const sampleDistancesKm = [0.25, 0.5, 0.75].map((f) => minDistanceKm + bandWidthKm * f);
    try {
      const results = await Promise.all(
        sampleDistancesKm.map((distKm) =>
          fetchOverpassPlaces({
            centre: destinationPoint(start, bearing, distKm),
            categories: wantedCats,
            radius: sampleRadiusKm * 1000,
            limit: 200,
            cap: 200,
          }).catch(() => [] as Awaited<ReturnType<typeof fetchOverpassPlaces>>)
        )
      );
      for (const places of results) ingestOverpass(places);
    } catch {
      /* keep what we have */
    }
  }

  if (finalCandidates.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No places found nearby for these categories. Try a wider radius or more categories.",
        overpassError,
      },
      { status: 404 }
    );
  }

  // Mode-based travel cost from the real Karnataka datasets. Fuel + BMTC apply
  // only to Bengaluru; train/flight use the KA fare data (per person). The
  // planner is fed an effective ₹/km so budget feasibility reflects the mode.
  const people = parsed.data.people;
  const inBlr = isBengaluru(searchCentre);
  const modeInfo = travelCostFor(mode, parsed.data.vehicle, 0, people, inBlr); // label only
  const effCostPerKm =
    mode === "flight"
      ? (FLIGHT_PER_KM || 10) * people
      : travelCostFor(mode, parsed.data.vehicle, 1, people, inBlr).cost;
  const flightBaseTotal = mode === "flight" ? Math.round((FLIGHT_BASE || 3000) * people) : 0;

  // Average driving speed scales with how far the traveller wants to roam: a
  // short in-city radius crawls in traffic (~30 km/h), while a long inter-city
  // radius runs mostly on highways (~58 km/h). Without this, a 200 km trip is
  // wrongly judged time-infeasible at an urban ~28 km/h and collapses back into
  // a 20–30 km cluster near the start.
  const avgSpeedKmh =
    radiusKm <= 25 ? 30 : radiusKm <= 60 ? 42 : radiusKm <= 120 ? 52 : 58;

  // Food money the trip must account for. Food is optional (`includeFood`); when
  // on, the traveller may enter their own trip food budget — otherwise we
  // estimate 3 budget meals/person/day. This baseline is RESERVED in the planner
  // (below) so the final total never silently blows past the chosen budget.
  const MEALS_PER_PERSON_PER_DAY = 350;
  const mealsBaseline = !parsed.data.includeFood
    ? 0
    : parsed.data.foodBudget != null
    ? parsed.data.foodBudget
    : people * parsed.data.days * MEALS_PER_PERSON_PER_DAY;
  // Fixed costs the planner doesn't itself pick but that land in the final total.
  const reservedCost = mealsBaseline + flightBaseTotal;

  // 3) Greedy pick.
  const plan = planMultiStop({
    start: parsed.data.start,
    totalBudget: parsed.data.totalBudget,
    hoursAvailable: parsed.data.hours,
    people,
    vehicle: parsed.data.vehicle,
    includeFood: parsed.data.includeFood,
    maxStops: parsed.data.maxStops,
    candidates: finalCandidates,
    avgSpeedKmh,
    reachKm: radiusKm,
    minDistanceKm,
    reservedCost,
    // The chosen km is how FAR FROM THE TRAVELLER a place may be (a reach
    // radius), not the whole loop length. Allow the round trip to actually reach
    // the far edge and come back (plus inter-stop detours) — after the ×1.25
    // road factor this bounds the routed trip at ~2× the chosen distance — so a
    // big radius yields a genuinely wide-ranging trip instead of hugging home.
    maxTripKm: radiusKm * 2.5,
    costPerKm: effCostPerKm,
    excludeIds: parsed.data.excludeIds,
  });

  if (plan.stops.length === 0) {
    // Distinguish "budget can't even cover the basics" from "nothing nearby fits"
    // so the traveller knows whether to raise the budget or change the trip.
    const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
    const tooLowForBasics = reservedCost >= parsed.data.totalBudget;
    const basics: string[] = [];
    if (mealsBaseline > 0) basics.push(`${inr(mealsBaseline)} for food`);
    if (flightBaseTotal > 0) basics.push(`${inr(flightBaseTotal)} for flights`);
    return NextResponse.json(
      {
        ok: false,
        error: tooLowForBasics
          ? `This budget of ${inr(parsed.data.totalBudget)} is too low — the basics alone need about ${inr(
              reservedCost
            )}${basics.length ? ` (${basics.join(" + ")})` : ""} for ${people} traveller${
              people > 1 ? "s" : ""
            } over ${parsed.data.days} day${parsed.data.days > 1 ? "s" : ""}. Raise the budget, lower your food budget, or reduce people/days.`
          : "Nothing fits within this budget and time from your location. Try a higher budget, more hours/days, a larger distance — or pick an area closer to where you are.",
      },
      { status: 422 }
    );
  }

  // 4) Build the journey through the stops IN THE PLANNER'S ORDER.
  //  • Road modes (car / bike / bus / any): real OSRM driving route.
  //  • Train / flight: straight rail line / flight arc between stops (drawn on
  //    the client), costed + timed from great-circle distance.
  const isAir = mode === "train" || mode === "flight";
  let orderedStops = plan.stops;
  let travelTotal = 0;
  let totalDistanceKm = plan.totalDistanceKm * 2;
  let totalDurationMinutes = plan.totalMinutes;
  let geometry: [number, number][] | null = null;
  let legsOut: Array<{ distanceKm: number; durationMinutes: number }> | null = null;

  if (!isAir) {
    const routeWaypoints = [
      parsed.data.start,
      ...plan.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      parsed.data.start, // return home — closes the loop
    ];
    const route = await fetchRoute(routeWaypoints);
    if (route && route.legs.length >= plan.stops.length) {
      orderedStops = plan.stops.map((s, k) => {
        const leg = route.legs[k];
        if (!leg) return s;
        return {
          ...s,
          arrivalKmFromPrev: leg.distanceKm,
          arrivalMinutesFromPrev: leg.durationMinutes,
          travelCost: Math.round(leg.distanceKm * effCostPerKm),
        };
      });
      travelTotal = Math.round(route.distanceKm * effCostPerKm);
      totalDistanceKm = route.distanceKm;
      totalDurationMinutes = route.durationMinutes;
      geometry = route.geometry ?? null;
      legsOut = route.legs;
    } else {
      // OSRM unavailable — fall back to the planner's haversine legs.
      orderedStops = plan.stops.map((s) => ({ ...s, travelCost: Math.round(s.arrivalKmFromPrev * effCostPerKm) }));
      travelTotal = orderedStops.reduce((a, s) => a + s.travelCost, 0);
    }
  } else {
    // Train / flight — geodesic legs, no OSRM. Faster and semantically right.
    const speedKmh = mode === "flight" ? 500 : 55;
    let prev = { lat: parsed.data.start.lat, lng: parsed.data.start.lng };
    let distSum = 0;
    orderedStops = plan.stops.map((s) => {
      const legKm = haversineKm(prev, { lat: s.lat, lng: s.lng });
      prev = { lat: s.lat, lng: s.lng };
      distSum += legKm;
      return {
        ...s,
        arrivalKmFromPrev: Math.round(legKm * 10) / 10,
        arrivalMinutesFromPrev: Math.round((legKm / speedKmh) * 60),
        travelCost: Math.round(legKm * effCostPerKm),
      };
    });
    distSum += haversineKm(prev, { lat: parsed.data.start.lat, lng: parsed.data.start.lng });
    totalDistanceKm = Math.round(distSum * 10) / 10;
    totalDurationMinutes = Math.round((distSum / speedKmh) * 60);
    travelTotal = Math.round(distSum * effCostPerKm) + flightBaseTotal;
  }

  // 5) Stay suggestions were removed from the planner by product decision — the
  // plan focuses purely on places, travel, entry and food. Keep the fields as
  // zero/null so the client's cost breakdown simply omits the stay row.
  const nights = Math.max(0, parsed.data.days - 1);
  const stayNightly = 0;
  const stayRooms = 0;
  const stayTotal = 0;
  const staySuggestion: null = null;

  // 6) TRAIN-mode guidance — which station to board from (nearest to the
  // traveller) and which to reach (nearest to the destination area).
  let trainInfo: {
    board: Awaited<ReturnType<typeof findNearestStation>>;
    dest: Awaited<ReturnType<typeof findNearestStation>>;
  } | null = null;
  if (mode === "train") {
    const [board, dest] = await Promise.all([
      findNearestStation(parsed.data.start),
      findNearestStation(searchCentre),
    ]);
    trainInfo = { board, dest };
  }

  // 7) Multi-modal comparison over this trip's distance — cost + time for every
  // mode, so the traveller can pick the cheapest / fastest / best-balance route.
  const MODES: { mode: TravelMode; label: string; vehicle: VehicleKind }[] = [
    { mode: "car", label: "Car", vehicle: "small_car" },
    { mode: "bike", label: "Bike", vehicle: "bike" },
    { mode: "bus", label: "Bus", vehicle: "suv" },
    { mode: "train", label: "Train", vehicle: "small_car" },
  ];
  const roadDur = !isAir ? totalDurationMinutes : Math.round((totalDistanceKm / 30) * 60);
  const rawOptions = MODES.map((m) => {
    const c = travelCostFor(m.mode, m.vehicle, totalDistanceKm, people, inBlr);
    const durationMinutes =
      m.mode === "train"
        ? Math.round((totalDistanceKm / 55) * 60) + 30
        : m.mode === "flight"
        ? Math.round((totalDistanceKm / 500) * 60) + 120
        : m.mode === "bus"
        ? Math.round(roadDur * 1.3)
        : roadDur;
    return { mode: m.mode, label: m.label, cost: c.cost, durationMinutes, fareLabel: c.label };
  });
  const maxC = Math.max(1, ...rawOptions.map((o) => o.cost));
  const maxT = Math.max(1, ...rawOptions.map((o) => o.durationMinutes));
  const cheapestMode = rawOptions.reduce((a, b) => (b.cost < a.cost ? b : a)).mode;
  const fastestMode = rawOptions.reduce((a, b) => (b.durationMinutes < a.durationMinutes ? b : a)).mode;
  // Balanced score: 60% budget, 40% time — the "shortest route, low budget, time saving".
  const score = (o: { cost: number; durationMinutes: number }) => 0.6 * (o.cost / maxC) + 0.4 * (o.durationMinutes / maxT);
  const recommendedMode = rawOptions.reduce((a, b) => (score(b) < score(a) ? b : a)).mode;
  const modeOptions = rawOptions.map((o) => ({
    ...o,
    cheapest: o.mode === cheapestMode,
    fastest: o.mode === fastestMode,
    recommended: o.mode === recommendedMode,
  }));

  // Break the cost into travel + entry + food + stay so each can be shown.
  const entryFeesTotal = orderedStops.reduce((sum, s) => sum + s.entryFee * people, 0);
  const stopCostTotal = orderedStops.reduce((sum, s) => sum + s.stopCost, 0);
  const stopFood = Math.max(0, stopCostTotal - entryFeesTotal);
  // The food line is at least the reserved meals baseline (the traveller's own
  // food budget, or the 3-meals/person/day estimate) — computed before planning
  // so the plan already fits it — but rises if food stops cost more.
  const foodTotal = Math.max(stopFood, mealsBaseline);
  const extraFood = foodTotal - stopFood; // meals beyond the eatery stops
  const fuelTotal = travelTotal;
  const realTotalCost = fuelTotal + stopCostTotal + extraFood + stayTotal;
  const realPerPerson = Math.round(realTotalCost / Math.max(1, people));

  // plan.unspentMinutes is based on the planner's own one-way, haversine-based
  // time estimate (no return-to-start leg) — it understates real time spent
  // once totalDurationMinutes above becomes the actual routed ROUND TRIP
  // (real roads + the drive back), which is what let a "still 9 not 10 stops,
  // but time left over" plan get generated: the leftover time shown wasn't
  // real. Recompute against the SAME time budget the planner used, but with
  // the real driving duration + real stop dwell time.
  const dwellMinutes = orderedStops.reduce((sum, s) => sum + s.idealMinutes, 0);
  const realUnspentMinutes = Math.max(
    0,
    Math.round(plan.minutesBudget - totalDurationMinutes - dwellMinutes)
  );

  // Alternatives — strong candidates we considered but didn't include, so the
  // traveller can swap any stop ("already visited / replace") for another place.
  const usedIds = new Set(orderedStops.map((s) => s.id));
  const alternatives = finalCandidates
    .filter((c) => !usedIds.has(c.id))
    .sort((a, b) => (b.popularity ?? 50) - (a.popularity ?? 50))
    .slice(0, 40)
    .map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      lat: c.lat,
      lng: c.lng,
      entryFee: c.entryFee,
      entryFeeKnown: c.entryFeeKnown ?? false,
      idealMinutes: c.idealMinutes,
      foodCostPerPerson: c.foodCostPerPerson,
      imageUrl: c.imageUrl,
      meta: c.meta,
    }));

  return NextResponse.json({
    ok: true,
    candidatesConsidered: finalCandidates.length,
    overpassPlaces: overpassCount,
    seedPlaces: seedCandidates.length + destCandidates.length + nearbyCandidates.length,
    overpassError,
    stops: orderedStops,
    alternatives,
    mode,
    travelLabel: modeInfo.label,
    travelPerPerson: modeInfo.perPerson,
    inBengaluru: inBlr,
    modeOptions,
    trainInfo,
    staySuggestion,
    totals: {
      distanceKm: totalDistanceKm,
      durationMinutes: totalDurationMinutes,
      cost: realTotalCost,
      perPersonCost: realPerPerson,
      fuelTotal,
      entryFeesTotal,
      foodTotal,
      stayTotal,
      stayNightly,
      stayNights: nights,
      stayRooms,
      unspentBudget: Math.max(0, parsed.data.totalBudget - realTotalCost),
      unspentMinutes: realUnspentMinutes,
    },
    geometry,
    legs: legsOut,
  });
}
