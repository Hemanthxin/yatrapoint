import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cityPlaces, destinations } from "@/lib/db/schema";
import { fetchOverpassPlaces, type OverpassCategory } from "@/lib/overpass";
import { fetchRoute } from "@/lib/routing";
import { haversineKm } from "@/lib/geo";
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
import { estimateNightlyRate } from "@/lib/queries/hotels";
import type { CategorySlug } from "@/lib/catalog/categories";

export const runtime = "nodejs";

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
  maxStops: z.number().int().min(2).max(15).default(6),
  searchRadiusKm: z.number().min(1).max(500).default(25),
  // Area mode: restrict the curated catalogue to these district(s)/taluk so a
  // chosen area only yields places from that area.
  areaDistricts: z.array(z.string()).max(50).default([]),
  // Travel mode — drives the cost model (fuel vs BMTC/train/flight fares) and
  // the map style (road route vs rail line vs flight arc).
  mode: z.enum(["any", "car", "bike", "bus", "train", "flight"]).default("any"),
  // Number of days — used for the nightly stay cost (nights = days − 1).
  days: z.number().int().min(1).max(30).default(1),
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
      const op = DEST_CATEGORY_TO_OVERPASS[d.category] ?? "tourist_attraction";
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
      // Honour the chosen radius — don't let the whole curated city catalogue
      // leak in regardless of how far the traveller wants to roam.
      return withinRadius(Number(s.latitude), Number(s.longitude));
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
        entryFee: isOsmSeed ? 0 : s.entryFeePerPerson,
        entryFeeKnown: !isOsmSeed,
        idealMinutes: s.idealMinutesAtPlace,
        foodCostPerPerson:
          s.avgCostForTwo != null ? Math.round(s.avgCostForTwo / 2) : undefined,
        popularity: s.popularity,
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
    if (!withinRadius(lat, lng)) continue;
    if (!matchesArea(d.district)) continue;
    let op: OverpassCategory;
    if (d.category === "pilgrimage") {
      // Route the worship place to its real religion-specific filter so a
      // mosque/dargah/church never shows up under a "temples" request.
      const w = worshipKind(d.name) ?? "temple";
      if (!wantedCats.includes(w)) continue;
      op = w;
    } else {
      const mapped = DEST_CAT_TO_OVERPASS[d.category] ?? ["tourist_attraction"];
      const matched = mapped.filter((c) => wantedCats.includes(c));
      if (matched.length === 0) continue;
      op = matched[0];
    }
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
      meta: { citySeedSlug: d.slug },
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
      if (
        haversineKm({ lat: c.lat, lng: c.lng }, { lat: p.lat, lng: p.lng }) <= 0.6 &&
        (isSubset(tk, p.tokens) || isSubset(p.tokens, tk))
      ) {
        return false;
      }
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

  let overpassCount = 0;
  let overpassError: string | null = null;

  const addOverpass = async (km: number) => {
    const places = await fetchOverpassPlaces({
      centre: searchCentre,
      categories: wantedCats,
      radius: km * 1000,
      limit: 250,
      cap: 250,
    });
    overpassCount += places.length;
    for (const op of places) {
      // Railway stations legitimately contain "station"/"railway" in the name —
      // don't junk-filter them (they're wanted in train mode).
      if (op.category !== "station" && JUNK_NAME.test(op.name)) continue;
      addCandidate(candidateFromOverpass(op));
    }
  };

  let currentKm = radiusKm;
  try {
    if (wantedCats.length > 0) await addOverpass(currentKm);
  } catch (err) {
    overpassError = err instanceof Error ? err.message : "Overpass failed";
  }

  // Gentle widen ONLY if the area is so sparse we can't fill the requested
  // stops — and never beyond ~1.5× the chosen distance, so we honour the km
  // the user asked to travel.
  const maxWidenKm = radiusKm * 1.5;
  let widen = 0;
  while (wantedCats.length > 0 && finalCandidates.length < parsed.data.maxStops && currentKm < maxWidenKm && widen < 1 && !overpassError) {
    currentKm = Math.min(maxWidenKm, currentKm * 1.5);
    widen += 1;
    try {
      await addOverpass(currentKm);
    } catch {
      break;
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
    reachKm: radiusKm,
    costPerKm: effCostPerKm,
  });

  if (plan.stops.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Nothing fits within this budget and time from your location. Try a higher budget, more hours/days, a larger distance — or pick an area closer to where you are.",
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

  // 5) Nightly stay cost for multi-day trips (nights = days − 1), from the
  // real hotel dataset — Bengaluru rates for Bengaluru trips.
  const nights = Math.max(0, parsed.data.days - 1);
  let stayNightly = 0;
  let stayRooms = 0;
  let stayTotal = 0;
  if (nights > 0) {
    const stayCity = inBlr ? "Bengaluru" : parsed.data.areaDistricts[0] || undefined;
    stayNightly = await estimateNightlyRate(stayCity);
    stayRooms = Math.max(1, Math.ceil(people / 2));
    stayTotal = stayNightly * stayRooms * nights;
  }

  // Break the cost into travel + entry + food + stay so each can be shown.
  const entryFeesTotal = orderedStops.reduce((sum, s) => sum + s.entryFee * people, 0);
  const stopCostTotal = orderedStops.reduce((sum, s) => sum + s.stopCost, 0);
  const foodTotal = Math.max(0, stopCostTotal - entryFeesTotal);
  const fuelTotal = travelTotal;
  const realTotalCost = fuelTotal + stopCostTotal + stayTotal;
  const realPerPerson = Math.round(realTotalCost / Math.max(1, people));

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
      meta: c.meta,
    }));

  return NextResponse.json({
    ok: true,
    candidatesConsidered: finalCandidates.length,
    overpassPlaces: overpassCount,
    seedPlaces: seedCandidates.length + destCandidates.length,
    overpassError,
    stops: orderedStops,
    alternatives,
    mode,
    travelLabel: modeInfo.label,
    travelPerPerson: modeInfo.perPerson,
    inBengaluru: inBlr,
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
      unspentMinutes: plan.unspentMinutes,
    },
    geometry,
    legs: legsOut,
  });
}
