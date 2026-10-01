import { eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { places, festivalSuggestions } from "@/lib/db/schema";
import { visibleWhere, searchPlaces } from "@/lib/queries/places";
import { searchVariants } from "@/lib/place-aliases";
import { listUserTripPlans, type TripPlanWithItems } from "@/lib/queries/trip-plans";
import { haversineKm, type LatLng } from "@/lib/geo";
import { isBengaluru, travelCostFor } from "@/lib/transport";
import { fetchTrip } from "@/lib/routing";
import { bucketStopsByDay, GROUP_FOOD_PER_PERSON_PER_DAY, type ItineraryStop, type ItineraryDay } from "@/lib/itinerary";
import { FESTIVALS, type Festival } from "@/lib/festivals";

// The Saafera Assistant answers from real project data only — never a
// generative model — so it can't invent a feature, a place, or a fact that
// doesn't exist: (1) a hard-coded, accurate description of what the app
// actually does, kept honest about what it does NOT do (no car booking, no
// payments, no user star-ratings, no group voting); (2) live rows from the
// `places` table (ratings, popularity, curated `bestMonths`); (3) the real
// festival list; (4) the signed-in traveller's own saved trip plans.

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function currentMonthAbbr(): string {
  return MONTH_ABBR[new Date().getMonth()];
}

// A named season maps to the real months it covers in India; "this
// month"/"now"/no season word at all defaults to the current calendar month.
function seasonMonths(question: string): string[] {
  if (/\bmonsoon\b/.test(question)) return ["Jun", "Jul", "Aug", "Sep"];
  if (/\bwinter\b/.test(question)) return ["Nov", "Dec", "Jan", "Feb"];
  if (/\bsummer\b/.test(question)) return ["Mar", "Apr", "May"];
  return [currentMonthAbbr()];
}

// Free-text hints -> the exact `places.category` value they map to (the
// vocabulary used by the destinations admin form — see PlaceForm.tsx). Only
// real categories are ever used; there is no "Wildlife" category in this
// catalogue, so wildlife questions fall through to a keyword search instead.
const CATEGORY_HINTS: Array<{ words: string[]; category: string }> = [
  { words: ["beach", "sea", "coast", "coastal"], category: "Beach" },
  { words: ["hill station", "hill", "mountain", "cold", "snow", "cool weather"], category: "Hill Station" },
  { words: ["temple", "pilgrim", "shrine", "spiritual"], category: "Temple" },
  { words: ["waterfall", "falls"], category: "Waterfall" },
  { words: ["museum"], category: "Museum" },
  { words: ["park", "garden"], category: "Park" },
  { words: ["lake"], category: "Lake" },
  { words: ["heritage", "fort", "palace", "monument", "architecture"], category: "Heritage" },
  { words: ["adventure", "trek", "trekking"], category: "Adventure" },
  { words: ["market", "shopping", "souvenir"], category: "Market" },
  { words: ["restaurant", "food", "eat", "cuisine"], category: "Restaurant" },
];

function detectCategory(question: string): string | null {
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((w) => question.includes(w))) return hint.category;
  }
  return null;
}

// A handful of interest words that don't map to a real category but ARE
// worth a free-text search across the place's own highlights/tags/description
// — still real data, never a guess.
const KEYWORD_HINTS: Array<{ words: string[]; keyword: string }> = [
  { words: ["wildlife", "safari", "sanctuary", "national park"], keyword: "wildlife" },
  { words: ["viewpoint", "sunrise", "sunset"], keyword: "view" },
  { words: ["coffee estate", "coffee plantation"], keyword: "coffee" },
];

function detectKeyword(question: string): string | null {
  for (const hint of KEYWORD_HINTS) {
    if (hint.words.some((w) => question.includes(w))) return hint.keyword;
  }
  return null;
}

const HIDDEN_WORDS = ["hidden", "lesser-known", "lesser known", "less-crowded", "less crowded", "offbeat", "underrated", "unusual"];

// "5k", "₹5000", "rs 5,000", "5000 rupees", "budget of 5000" — only matches an
// explicit money mention, never a bare number, so "5 best places" isn't
// mistaken for a ₹5 budget.
function parseBudgetInr(question: string): number | null {
  const patterns = [
    /₹\s*([\d,]+(?:\.\d+)?)\s*(k)?/i,
    /\brs\.?\s*([\d,]+(?:\.\d+)?)\s*(k)?/i,
    /\bbudget(?:\s+of)?\s+(?:₹|rs\.?)?\s*([\d,]+(?:\.\d+)?)\s*(k)?/i,
    /\b([\d,]+(?:\.\d+)?)\s*(?:rupees|inr)\b/i,
    // Bare "5k" with no ₹/rs/"budget of" cue — "k" must be its own capture
    // group here too, or `m[2]` is undefined and the ×1000 multiplier never
    // applies (this exact bug shipped once already: "I have 5k" was read as
    // a ₹5 budget).
    /\b([\d,]+(?:\.\d+)?)\s*(k)\b/i,
  ];
  for (const re of patterns) {
    const m = question.match(re);
    if (!m) continue;
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(num) || num <= 0) continue;
    return m[2] ? num * 1000 : num;
  }
  return null;
}

// Text after "in"/"near"/"around", trimmed of trailing filler words — a light
// heuristic, never asserted as fact: it only narrows a real district/city/
// state/base-city match, and an area that matches nothing simply falls back
// to an unfiltered (still real) list.
const AREA_TRAILING_NOISE = /\b(for|during|with|trip|day|weekend|budget|hours?|km|kms|month|please|now|right now)\b.*$/i;
function extractArea(question: string): string | null {
  const m = question.match(/\b(?:in|near|around)\s+(.+)$/i);
  if (!m) return null;
  const area = m[1]
    .replace(/[?.!]+$/, "")
    .replace(AREA_TRAILING_NOISE, "")
    .trim();
  return area.length >= 3 ? area : null;
}

function areaCondition(areaText: string): SQL | undefined {
  const variants = searchVariants(areaText);
  if (variants.length === 0) return undefined;
  const parts = variants.flatMap((v) => [
    sql`lower(coalesce(${places.district}, '')) LIKE ${"%" + v + "%"}`,
    sql`lower(coalesce(${places.city}, '')) LIKE ${"%" + v + "%"}`,
    sql`lower(coalesce(${places.state}, '')) LIKE ${"%" + v + "%"}`,
    sql`lower(coalesce(${places.baseCity}, '')) LIKE ${"%" + v + "%"}`,
  ]);
  return or(...parts);
}

interface PlaceRow {
  name: string;
  district: string | null;
  state: string | null;
  category: string;
  shortDescription: string;
  entryFeePerPerson: number;
  googleRating: number | null;
  latitude: string | null;
  longitude: string | null;
}

const PLACE_COLUMNS = {
  name: places.name,
  district: places.district,
  state: places.state,
  category: places.category,
  shortDescription: places.shortDescription,
  entryFeePerPerson: places.entryFeePerPerson,
  googleRating: places.googleRating,
  latitude: places.latitude,
  longitude: places.longitude,
};

interface FindPlacesOptions {
  category?: string | null;
  areaText?: string | null;
  monthAbbrs?: string[] | null;
  keyword?: string | null;
  preferHidden?: boolean;
  excludeName?: string;
  // Bound the search to a real geographic box around a point — used for "what's
  // near X" so the candidates are actually close to X, not just nationally
  // top-rated (the same bounding-box technique used by the multi-stop planner,
  // for the same reason: a plain global sort would miss genuinely nearby but
  // lower-rated places, or return nothing near an obscure anchor at all).
  near?: { origin: LatLng; radiusKm: number };
  limit?: number;
}

// The one place the assistant reads real catalogue rows from. Every filter is
// optional and additive; an unmatched area/category never errors, it just
// narrows nothing.
async function findPlaces(opts: FindPlacesOptions): Promise<PlaceRow[]> {
  const conditions: (SQL | undefined)[] = [eq(places.isHidden, false)];
  if (opts.category) conditions.push(eq(places.category, opts.category));
  if (opts.monthAbbrs?.length) {
    const monthOr = or(...opts.monthAbbrs.map((m) => sql`${places.bestMonths} LIKE ${"%" + m + "%"}`));
    conditions.push(sql`${places.bestMonths} IS NOT NULL AND (${monthOr})`);
  }
  if (opts.areaText) conditions.push(areaCondition(opts.areaText));
  if (opts.near) {
    const { origin, radiusKm } = opts.near;
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180)));
    conditions.push(
      sql`${places.latitude}::float8 BETWEEN ${origin.lat - dLat} AND ${origin.lat + dLat}`,
      sql`${places.longitude}::float8 BETWEEN ${origin.lng - dLng} AND ${origin.lng + dLng}`
    );
  }
  if (opts.keyword) {
    const k = "%" + opts.keyword.toLowerCase() + "%";
    conditions.push(
      or(
        sql`lower(coalesce(${places.highlights}, '')) LIKE ${k}`,
        sql`lower(coalesce(${places.tags}, '')) LIKE ${k}`,
        sql`lower(${places.shortDescription}) LIKE ${k}`,
        sql`lower(${places.description}) LIKE ${k}`
      )
    );
  }
  if (opts.excludeName) conditions.push(sql`${places.name} <> ${opts.excludeName}`);

  const orderBy = opts.preferHidden
    ? [sql`${places.popularity} ASC`, sql`${places.googleRating} DESC NULLS LAST`]
    : [sql`${places.googleRating} DESC NULLS LAST`, sql`${places.popularity} DESC`];

  return db
    .select(PLACE_COLUMNS)
    .from(places)
    .where(visibleWhere(...conditions))
    .orderBy(...orderBy)
    .limit(opts.limit ?? 8);
}

interface RankedPlace extends PlaceRow {
  distanceKm: number | null;
  // Cheapest realistic round-trip fare (bus or train, whichever is lower),
  // using the same per-km rates as the real Budget Planner — null when we
  // don't know the traveller's location.
  travelCostInr: number | null;
}

const FOOD_RESERVE_PER_DAY = 350; // matches the planner's own meals estimate

// Cheapest of bus/train per-person fare for the round trip, using the exact
// same fare-per-km data the Budget Planner itself uses — never a made-up
// number. So a place a traveller genuinely can't afford to reach is never
// suggested for a tight budget.
function estimateRoundTripCost(origin: LatLng, dest: LatLng): { distanceKm: number; costInr: number } {
  const distanceKm = haversineKm(origin, dest);
  const roundTripKm = distanceKm * 2;
  const inBlr = isBengaluru(origin);
  const bus = travelCostFor("bus", "small_car", roundTripKm, 1, inBlr).cost;
  const train = travelCostFor("train", "small_car", roundTripKm, 1, inBlr).cost;
  return { distanceKm, costInr: Math.min(bus, train) };
}

function rankPlaces(rows: PlaceRow[], origin: LatLng | null): RankedPlace[] {
  return rows.map((p) => {
    const lat = p.latitude ? Number(p.latitude) : NaN;
    const lng = p.longitude ? Number(p.longitude) : NaN;
    if (!origin || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ...p, distanceKm: null, travelCostInr: null };
    }
    const { distanceKm, costInr } = estimateRoundTripCost(origin, { lat, lng });
    return { ...p, distanceKm, travelCostInr: costInr };
  });
}

function placeCoords(p: PlaceRow): LatLng | null {
  const lat = p.latitude ? Number(p.latitude) : NaN;
  const lng = p.longitude ? Number(p.longitude) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function formatPlace(p: RankedPlace): string {
  const location = [p.district, p.state].filter(Boolean).join(", ");
  const rating = p.googleRating ? ` (★${p.googleRating.toFixed(1)})` : "";
  const fee = p.entryFeePerPerson > 0 ? `entry ₹${p.entryFeePerPerson}/person` : "free entry";
  const distance = p.distanceKm != null ? `, ~${Math.round(p.distanceKm)} km away` : "";
  const travel =
    p.travelCostInr != null ? `, ~₹${p.travelCostInr.toLocaleString("en-IN")} round trip by bus/train` : "";
  return `- **${p.name}**${rating}${location ? ` — ${location}` : ""}${distance}, ${fee}${travel}. ${p.shortDescription}`;
}

// Applies a budget on top of an already-ranked list — shared by every intent
// that can recommend places (seasonal picks, area browsing, nearby search).
function applyBudget(ranked: RankedPlace[], budgetInr: number, hasOrigin: boolean): { ranked: RankedPlace[]; note: string | null } {
  if (!hasOrigin) {
    const affordable = ranked.filter((p) => p.entryFeePerPerson <= budgetInr);
    return {
      ranked: affordable.length ? affordable : ranked,
      note: "I don't have your live location yet (allow location access in your browser), so this doesn't account for travel cost to get there — only entry fees.",
    };
  }
  const affordable = ranked.filter(
    (p) => p.travelCostInr == null || p.travelCostInr + p.entryFeePerPerson + FOOD_RESERVE_PER_DAY <= budgetInr
  );
  if (affordable.length > 0) {
    affordable.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return { ranked: affordable, note: null };
  }
  const cheapest = [...ranked].sort((a, b) => (a.travelCostInr ?? Infinity) - (b.travelCostInr ?? Infinity));
  return {
    ranked: cheapest,
    note: `Nothing here fits a ₹${budgetInr.toLocaleString("en-IN")} budget from your location (round-trip travel alone would cost more) — showing the cheapest-to-reach options instead so you can see how much you'd need.`,
  };
}

// ---------------------------------------------------------------------------
// General place-finder — the single intent behind most "best/good/suitable
// places" questions (climate, budget, category, area, hidden gems, and
// combinations of these).
// ---------------------------------------------------------------------------

interface ListAnswer {
  text: string;
  topPlace: string | null;
}

async function answerPlaceFinder(question: string, origin: LatLng | null): Promise<ListAnswer> {
  const category = detectCategory(question);
  const keyword = category ? null : detectKeyword(question);
  const areaText = extractArea(question);
  const budgetInr = parseBudgetInr(question);
  const preferHidden = HIDDEN_WORDS.some((w) => question.includes(w));
  const wantsSeason = /\b(climate|weather|season|monsoon|winter|summer|visit now|right now|currently|this month|best time)\b/.test(
    question
  );
  // A hard month filter only when the traveller asked about timing AND didn't
  // also name an area — an area-scoped question ("best places in Coorg")
  // should still answer for Coorg even if nothing there is tagged for this
  // exact month.
  const monthAbbrs = wantsSeason && !areaText ? seasonMonths(question) : null;

  let rows = await findPlaces({ category, areaText, monthAbbrs, keyword, preferHidden, limit: 8 });
  if (rows.length === 0 && areaText) {
    // Area matched nothing (spelling Saafera doesn't recognise, or genuinely
    // thin coverage there) — retry without the area rather than going empty.
    rows = await findPlaces({ category, monthAbbrs, keyword, preferHidden, limit: 8 });
  }
  if (rows.length === 0) {
    return {
      text: "I couldn't find a specific match for that in Saafera's catalogue — try browsing Destinations directly, or ask more generally (e.g. \"best temples in Karnataka\").",
      topPlace: null,
    };
  }

  let ranked = rankPlaces(rows, origin);
  const notes: string[] = [];

  if (budgetInr != null) {
    const applied = applyBudget(ranked, budgetInr, !!origin);
    ranked = applied.ranked;
    if (applied.note) notes.push(applied.note);
  } else if (origin) {
    ranked.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
  ranked = ranked.slice(0, 5);

  const monthName = new Date().toLocaleDateString("en-IN", { month: "long" });
  const parts: string[] = [];
  if (preferHidden) parts.push("hidden-gem");
  if (category) parts.push(category.toLowerCase());
  const subject = parts.length ? parts.join(" ") : "top";
  const where = areaText ? ` in ${areaText}` : "";
  const when = monthAbbrs ? ` for ${monthName}` : "";
  const budgetSuffix = budgetInr ? `, within ₹${budgetInr.toLocaleString("en-IN")}` : "";
  const heading = `${subject === "top" ? "Places" : `${subject.charAt(0).toUpperCase()}${subject.slice(1)} places`} rated well${where}${when}${budgetSuffix}:`;

  return {
    text: [...notes, heading, "", ...ranked.map(formatPlace)].filter(Boolean).join("\n"),
    topPlace: ranked[0]?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Distance between two named places, and "what's near X" for a specific
// attraction (not a district/state/city — that's the area-finder above).
// ---------------------------------------------------------------------------

async function findOnePlace(name: string): Promise<{ row: PlaceRow; strong: boolean } | null> {
  const results = await searchPlaces(db, name, { limit: 1 });
  if (results.length === 0) return null;
  const p = results[0].place;
  return {
    row: {
      name: p.name,
      district: p.district,
      state: p.state,
      category: p.category,
      shortDescription: p.shortDescription,
      entryFeePerPerson: p.entryFeePerPerson,
      googleRating: p.googleRating,
      latitude: p.latitude,
      longitude: p.longitude,
    },
    strong: results[0].score >= 70,
  };
}

interface PlaceAnswer {
  text: string;
  place: string;
}

async function answerDistanceQuestion(a: string, b: string): Promise<PlaceAnswer | null> {
  const [from, to] = await Promise.all([findOnePlace(a), findOnePlace(b)]);
  if (!from?.strong || !to?.strong) return null;
  const fromCoords = placeCoords(from.row);
  const toCoords = placeCoords(to.row);
  if (!fromCoords || !toCoords) return null;
  const straight = haversineKm(fromCoords, toCoords);
  const roadEstimate = straight * 1.25; // same road-vs-straight-line factor used by the trip planner
  return {
    text: `${to.row.name} is roughly ${Math.round(straight)} km from ${from.row.name} in a straight line — about ${Math.round(roadEstimate)} km by road.`,
    place: from.row.name,
  };
}

// "How far is it from me?" — distance from the traveller's real live location
// to a place already established by context, using the same road-vs-straight-
// line factor as everywhere else.
function answerDistanceFromMe(place: PlaceRow, origin: LatLng): string | null {
  const coords = placeCoords(place);
  if (!coords) return null;
  const straight = haversineKm(origin, coords);
  const road = straight * 1.25;
  return `${place.name} is about ${Math.round(straight)} km from you in a straight line — roughly ${Math.round(road)} km by road.`;
}

async function answerNearbyToPlace(
  name: string,
  origin: LatLng | null,
  budgetInr: number | null,
  category: string | null
): Promise<PlaceAnswer | null> {
  const anchor = await findOnePlace(name);
  if (!anchor?.strong) return null;
  const anchorCoords = placeCoords(anchor.row);
  if (!anchorCoords) {
    return {
      text: `I have ${anchor.row.name} in the catalogue but no coordinates for it, so I can't find what's nearby.`,
      place: anchor.row.name,
    };
  }

  const candidates = await findPlaces({
    category,
    excludeName: anchor.row.name,
    near: { origin: anchorCoords, radiusKm: 60 },
    limit: 30,
  });
  // The box above is a generous SQL-side prefilter; trim its corners to the
  // real 60 km circle. Distance here is always relative to the ANCHOR place,
  // never the traveller — "near Mysore Palace" means near the palace, not
  // near wherever the traveller happens to be standing.
  let ranked = rankPlaces(candidates, anchorCoords).filter((p) => p.distanceKm != null && p.distanceKm <= 60);
  ranked.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  if (ranked.length === 0) {
    return { text: `I couldn't find other catalogued places within range of ${anchor.row.name}.`, place: anchor.row.name };
  }

  const notes: string[] = [];
  if (budgetInr != null) {
    // Affordability is judged from the TRAVELLER's real location (if known),
    // but the anchor-relative distance shown to them is left untouched.
    const travelCostByName = new Map(
      (origin ? rankPlaces(ranked, origin) : ranked).map((p) => [p.name, p.travelCostInr])
    );
    const withRealCost = ranked.map((p) => ({ ...p, travelCostInr: travelCostByName.get(p.name) ?? null }));
    const applied = applyBudget(withRealCost, budgetInr, !!origin);
    ranked = applied.ranked;
    if (applied.note) notes.push(applied.note);
  }
  ranked = ranked.slice(0, 5);

  return {
    text: [...notes, `Places near ${anchor.row.name}:`, "", ...ranked.map(formatPlace)].filter(Boolean).join("\n"),
    place: anchor.row.name,
  };
}

// ---------------------------------------------------------------------------
// Single named-place dossier — real fields only, never a guess about
// something not in the record (e.g. "suitable for a family" gets the real
// category/duration instead of an invented verdict).
// ---------------------------------------------------------------------------

// Words that carry the question's intent, not the place's name. Removing them
// leaves the place name behind however the traveller phrased it ("mysore
// palace where it is located", "give me briefly about mysore palace", ...).
const QUESTION_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "it", "its", "this", "that", "of", "in", "at", "on", "to", "for", "from", "with", "and", "or",
  "what", "whats", "where", "when", "which", "who", "whom", "how", "why", "tell", "give", "show", "me", "us", "please", "pls", "can", "could", "you", "i", "we",
  "about", "briefly", "brief", "short", "shortly", "detail", "details", "detailed", "info", "information", "explain", "describe", "description", "know", "want", "need",
  "located", "location", "situated", "address", "find", "reach", "there", "here", "do", "does", "did", "have", "has",
  "entry", "fee", "fees", "ticket", "tickets", "price", "cost", "timing", "timings", "time", "open", "opening", "close", "closing", "hours", "visit", "visiting",
  "best", "famous", "history", "special", "attractions", "suitable", "family", "trip", "long", "take", "explore", "far", "distance",
]);

function dossierCandidates(q: string): string[] {
  const tokens = q
    .toLowerCase()
    // Apostrophes first: "what's" -> "whats" (a QUESTION_WORDS entry) rather
    // than surviving as its own token. Without this, "what's the entry fee?"
    // left "what's" as the only candidate — which is not a question word by
    // itself — and it went on to match a real place literally named "What's
    // In a Name", answering a totally unrelated cafe's details with total
    // confidence. A caught-live bug, not a hypothetical.
    .replace(/['’]/g, "")
    .replace(/[?.!,]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !QUESTION_WORDS.has(t));
  if (tokens.length === 0) return [];
  // Longest contiguous run of name words first, then shorter windows, capped so
  // a garbled question can't trigger a pile of searches.
  const out: string[] = [];
  const n = Math.min(tokens.length, 5);
  for (let len = n; len >= 1 && out.length < 6; len--) {
    for (let i = 0; i + len <= tokens.length && out.length < 6; i++) {
      const phrase = tokens.slice(i, i + len).join(" ");
      if (phrase.length >= 4 && !out.includes(phrase)) out.push(phrase);
    }
  }
  return out;
}

function humanBestMonths(bestMonths: string | null): string | null {
  if (!bestMonths) return null;
  return bestMonths
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .join(", ");
}

async function answerPlaceDossier(question: string): Promise<PlaceAnswer | null> {
  let results: Awaited<ReturnType<typeof searchPlaces>> = [];
  for (const candidate of dossierCandidates(question)) {
    const found = await searchPlaces(db, candidate, { limit: 1 });
    if (found.length > 0 && found[0].score >= 70) {
      results = found;
      break;
    }
  }
  if (results.length === 0) return null;
  const p = results[0].place;

  const location = [p.district, p.state].filter(Boolean).join(", ");
  const rating = p.googleRating ? `★${p.googleRating.toFixed(1)}${p.googleRatingCount ? ` (${p.googleRatingCount} reviews)` : ""}` : null;
  const fee =
    p.entryFeePerPerson > 0
      ? `₹${p.entryFeePerPerson}/person` +
        (p.entryFeesForeigner ? `, ₹${p.entryFeesForeigner}/person for foreign nationals` : "") +
        (p.entryFeesChild ? `, ₹${p.entryFeesChild}/child` : "")
      : "free entry";
  const duration = p.idealHoursAtPlace
    ? `~${p.idealHoursAtPlace} hour(s)`
    : p.idealMinutesAtPlace
    ? `~${Math.round(p.idealMinutesAtPlace / 60)} hour(s)`
    : null;
  const bestMonths = humanBestMonths(p.bestMonths);

  const where = [p.area, p.city, p.district, p.state].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
  const lines = [`**${p.name}**${location ? ` — ${location}` : ""}`, p.shortDescription, ""];
  if (where) lines.push(`- Location: ${where}`);
  lines.push(`- Category: ${p.category}`);
  lines.push(`- Entry: ${fee}`);
  if (p.openingTimings) lines.push(`- Timings: ${p.openingTimings}`);
  if (duration) lines.push(`- Typical visit length: ${duration}`);
  if (bestMonths) lines.push(`- Best months: ${bestMonths}`);
  if (rating) lines.push(`- Google rating: ${rating}`);
  if (p.googleBusinessStatus === "CLOSED_TEMPORARILY") lines.push(`- ⚠ Currently showing as temporarily closed on Google.`);

  return { text: lines.join("\n"), place: p.name };
}

// ---------------------------------------------------------------------------
// Festivals — real data from the built-in list plus admin-approved
// community submissions, never invented.
// ---------------------------------------------------------------------------

async function approvedFestivalSuggestions(): Promise<Festival[]> {
  try {
    const rows = await db
      .select({
        name: festivalSuggestions.name,
        hub: festivalSuggestions.hub,
        dateISO: festivalSuggestions.dateISO,
        dateLabel: festivalSuggestions.dateLabel,
        significance: festivalSuggestions.significance,
      })
      .from(festivalSuggestions)
      .where(eq(festivalSuggestions.status, "approved"));
    return rows.map((r) => ({
      name: r.name,
      hub: r.hub,
      dateISO: r.dateISO,
      dateLabel: r.dateLabel ?? "",
      significance: r.significance,
      emoji: "🎉",
    }));
  } catch {
    return [];
  }
}

function formatFestival(f: Festival): string {
  const date = f.dateISO
    ? new Date(f.dateISO + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long" })
    : f.dateLabel;
  const hub = f.hub ? ` — ${f.hub}` : "";
  const sig = f.significance ? `. ${f.significance}` : "";
  return `- **${f.name}**${hub} (${date})${sig}`;
}

async function answerFestivalQuestion(question: string): Promise<string> {
  const all = [...FESTIVALS, ...(await approvedFestivalSuggestions())];

  // A specific festival named in the question — answer from its real record.
  const named = all.find((f) => question.includes(f.name.toLowerCase()));
  if (named) return formatFestival(named);

  const areaText = extractArea(question);
  let list = all;
  if (areaText) {
    const variants = searchVariants(areaText);
    const filtered = list.filter((f) => f.hub && variants.some((v) => f.hub!.toLowerCase().includes(v)));
    if (filtered.length > 0) list = filtered;
  }
  const monthAbbrs = seasonMonths(question);
  const byMonth = list.filter((f) => {
    if (!f.dateISO) return false;
    const abbr = MONTH_ABBR[Number(f.dateISO.slice(5, 7)) - 1];
    return monthAbbrs.includes(abbr);
  });
  const shortlist = (byMonth.length ? byMonth : list).slice(0, 6);
  if (shortlist.length === 0) return "I don't have any festivals matching that in Saafera's festival list — check the Festivals page for the full calendar.";
  const heading = byMonth.length ? "Festivals around this time:" : "From Saafera's festival list:";
  return [heading, "", ...shortlist.map(formatFestival)].join("\n");
}

// ---------------------------------------------------------------------------
// Trip-plan generation — "plan a trip to Goa for 2 days". Picks real,
// well-rated catalogue places in the named destination, orders them with the
// same OSRM TSP solver the Group Trip Planner's itinerary generation uses
// (falling back to a nearest-neighbour haversine chain when OSRM doesn't
// answer in time, same as everywhere else in the app), splits the ordered
// stops across the requested number of days by real travel+dwell time, and
// costs it with the same fare data the Budget Planner uses. Never invents a
// place, a distance, or a cost.
// ---------------------------------------------------------------------------

interface TripPlanRequest {
  destination: string;
  days: number;
  travellers: number;
  budgetInr: number | null;
}

// Requires an explicit "plan/build/create a trip|itinerary" phrasing, OR
// "trip to/for" — narrow enough that normal place-finder questions ("best
// places to visit in Goa") never get swept in here instead.
const TRIP_PLAN_TRIGGER = /\b(plan|build|create|make|suggest)\b[\s\S]*\b(trip|itinerary|vacation|holiday)\b|\bitinerary\b|\btrip\s+(?:to|for)\b/;

function parseTripPlanRequest(question: string): TripPlanRequest | null {
  if (!TRIP_PLAN_TRIGGER.test(question)) return null;

  const daysMatch = question.match(/\b(\d{1,2})\s*-?\s*days?\b/);
  const days = daysMatch ? Math.min(10, Math.max(1, parseInt(daysMatch[1], 10))) : 1;

  const travellersMatch = question.match(/\b(\d{1,2})\s*(?:people|persons|travellers|travelers|friends|members|pax|adults)\b/);
  const travellers = travellersMatch ? Math.min(20, Math.max(1, parseInt(travellersMatch[1], 10))) : 1;

  const budgetInr = parseBudgetInr(question);

  let destination: string | null = null;
  let m = question.match(/\bto\s+([a-z][a-z\s]{1,40}?)(?:\s+for\b|\s+with\b|\s+in\s+\d|[?.!]|$)/i);
  if (m) destination = m[1].trim();
  if (!destination) {
    m = question.match(/\b\d{1,2}\s*-?\s*days?\s+(?:trip\s+)?(?:to|in|at)\s+([a-z][a-z\s]{1,40}?)(?:[?.!]|$)/i);
    if (m) destination = m[1].trim();
  }
  if (!destination) {
    m = question.match(/^([a-z][a-z\s]{1,30}?)\s+trip\b/i);
    if (m) destination = m[1].trim();
  }
  if (!destination || destination.replace(/\s+/g, "").length < 3) return null;

  return { destination, days, travellers, budgetInr };
}

interface ItineraryCandidateRow {
  id: string;
  name: string;
  category: string;
  entryFeePerPerson: number;
  googleRating: number | null;
  latitude: string | null;
  longitude: string | null;
  imageUrl: string | null;
  idealHoursAtPlace: number | null;
  idealMinutesAtPlace: number | null;
}

async function findItineraryCandidates(areaText: string, limit: number): Promise<ItineraryCandidateRow[]> {
  const cond = areaCondition(areaText);
  if (!cond) return [];
  return db
    .select({
      id: places.id,
      name: places.name,
      category: places.category,
      entryFeePerPerson: places.entryFeePerPerson,
      googleRating: places.googleRating,
      latitude: places.latitude,
      longitude: places.longitude,
      imageUrl: places.imageUrl,
      idealHoursAtPlace: places.idealHoursAtPlace,
      idealMinutesAtPlace: places.idealMinutesAtPlace,
    })
    .from(places)
    .where(visibleWhere(eq(places.isHidden, false), cond))
    .orderBy(sql`${places.googleRating} DESC NULLS LAST`, sql`${places.popularity} DESC`)
    .limit(limit);
}

// Some well-known trip destinations are a locality WITHIN a district rather
// than a district/city/state value themselves (e.g. "Hampi" is a village in
// Vijayanagara district — it never appears in `district`/`city`/`state`, only
// inside place NAMES like "Hampi Royal Enclosure"). When the direct area
// match finds nothing, fall back to searching real place NAMES for the term
// and use whichever real district most of those hits actually share — never
// a guess, just letting the catalogue's own data say where "Hampi" is.
async function resolveItineraryArea(destinationText: string): Promise<string | null> {
  const direct = areaCondition(destinationText);
  if (direct) {
    const probe = await db
      .select({ id: places.id })
      .from(places)
      .where(visibleWhere(eq(places.isHidden, false), direct))
      .limit(1);
    if (probe.length > 0) return destinationText;
  }

  const term = "%" + destinationText.toLowerCase() + "%";
  const nameHits = await db
    .select({ district: places.district })
    .from(places)
    .where(visibleWhere(eq(places.isHidden, false), sql`lower(${places.name}) LIKE ${term}`))
    .limit(50);
  const counts = new Map<string, number>();
  for (const r of nameHits) {
    if (!r.district) continue;
    counts.set(r.district, (counts.get(r.district) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [district, count] of counts) {
    if (count > bestCount) {
      best = district;
      bestCount = count;
    }
  }
  return best;
}

// Collapse near-duplicate rows at essentially the same spot (e.g. "Se
// Cathedral" / "Sé Cathedral, Old Goa") — keeps the first (already the
// better-rated one, rows arrive rating-sorted).
function dedupeByLocation(rows: ItineraryCandidateRow[]): ItineraryCandidateRow[] {
  const seen = new Set<string>();
  const out: ItineraryCandidateRow[] = [];
  for (const r of rows) {
    if (r.latitude && r.longitude) {
      const key = `${Number(r.latitude).toFixed(2)},${Number(r.longitude).toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(r);
  }
  return out;
}

const AVG_SPEED_KMH = 40; // same ballpark fallback speed used elsewhere when OSRM is unavailable
const ROAD_FACTOR = 1.25; // same straight-line → road estimate factor used throughout this file

// Greedy nearest-neighbour chain by real-world (haversine × road factor)
// distance — used only when OSRM's /trip doesn't answer in time.
function nearestNeighborOrder(
  start: LatLng,
  points: LatLng[]
): { orderedIdx: number[]; legs: { distanceKm: number; durationMinutes: number }[]; totalDistanceKm: number; totalDurationMinutes: number } {
  const remaining = points.map((_, i) => i);
  const orderedIdx: number[] = [];
  const legs: { distanceKm: number; durationMinutes: number }[] = [];
  let current = start;
  let totalDistanceKm = 0;

  while (remaining.length > 0) {
    let bestPos = 0;
    let bestDist = Infinity;
    for (let k = 0; k < remaining.length; k++) {
      const d = haversineKm(current, points[remaining[k]]);
      if (d < bestDist) {
        bestDist = d;
        bestPos = k;
      }
    }
    const idx = remaining.splice(bestPos, 1)[0];
    const roadKm = bestDist * ROAD_FACTOR;
    orderedIdx.push(idx);
    legs.push({ distanceKm: roadKm, durationMinutes: (roadKm / AVG_SPEED_KMH) * 60 });
    totalDistanceKm += roadKm;
    current = points[idx];
  }
  const backKm = haversineKm(current, start) * ROAD_FACTOR;
  totalDistanceKm += backKm;
  const totalDurationMinutes = legs.reduce((a, l) => a + l.durationMinutes, 0) + (backKm / AVG_SPEED_KMH) * 60;
  return { orderedIdx, legs, totalDistanceKm, totalDurationMinutes };
}

// Orders every candidate place into one real route. When the traveller's live
// location is known, that's the fixed start/end of the loop; otherwise the
// best-rated place anchors the loop instead (there's nowhere real to start
// from) and the rest are routed from there. Always tries OSRM's real-road TSP
// solver first and only falls back to the haversine chain if it doesn't
// answer — same two-tier approach `generateItinerary` (Group Trip Planner)
// already uses.
async function orderTripStops(
  origin: LatLng | null,
  coordsList: LatLng[]
): Promise<{
  orderedIdx: number[];
  legs: { distanceKm: number; durationMinutes: number }[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
}> {
  const routeOrigin = origin ?? coordsList[0];
  const placesToVisit = origin ? coordsList : coordsList.slice(1);
  const indexOffset = origin ? 0 : 1; // placesToVisit[i] === coordsList[i + indexOffset]

  const trip =
    placesToVisit.length > 0
      ? await fetchTrip({ waypoints: [routeOrigin, ...placesToVisit], roundtrip: true, fixedFirst: true })
      : null;

  let orderedWithinVisit: number[] = [];
  let legsWithinVisit: { distanceKm: number; durationMinutes: number }[] = [];
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;

  if (trip) {
    orderedWithinVisit = trip.waypointOrder.slice(1).map((i) => i - 1);
    legsWithinVisit = trip.legs;
    totalDistanceKm = trip.distanceKm;
    totalDurationMinutes = trip.durationMinutes;
  } else if (placesToVisit.length > 0) {
    const nn = nearestNeighborOrder(routeOrigin, placesToVisit);
    orderedWithinVisit = nn.orderedIdx;
    legsWithinVisit = nn.legs;
    totalDistanceKm = nn.totalDistanceKm;
    totalDurationMinutes = nn.totalDurationMinutes;
  }

  const orderedIdx = orderedWithinVisit.map((i) => i + indexOffset);
  const legs = [...legsWithinVisit];
  if (!origin) {
    orderedIdx.unshift(0);
    legs.unshift({ distanceKm: 0, durationMinutes: 0 });
  }
  return { orderedIdx, legs, totalDistanceKm, totalDurationMinutes };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTripStop(s: ItineraryStop, index: number, isVeryFirstStop: boolean): string {
  const fee = s.entryFeePerPerson > 0 ? `₹${s.entryFeePerPerson}/person` : "free entry";
  const travel =
    s.arrivalKmFromPrev > 0.1
      ? `, ${Math.round(s.arrivalKmFromPrev)} km / ${Math.round(s.arrivalMinutesFromPrev)} min from ${
          isVeryFirstStop ? "your location" : "the previous stop"
        }`
      : "";
  return `- **${index + 1}. ${s.name}** — ${s.category}, ${fee}${travel}`;
}

function formatTripDay(day: ItineraryDay, isFirstDayOfTrip: boolean): string {
  return [`**Day ${day.day}:**`, ...day.stops.map((s, i) => formatTripStop(s, i, isFirstDayOfTrip && i === 0))].join("\n");
}

async function answerTripPlanRequest(req: TripPlanRequest, origin: LatLng | null): Promise<ListAnswer> {
  const resolvedArea = await resolveItineraryArea(req.destination);
  if (!resolvedArea) {
    return {
      text: `I couldn't find "${req.destination}" in Saafera's catalogue yet — check the spelling, try a nearby bigger town/district name, or browse Destinations directly.`,
      topPlace: null,
    };
  }
  const poolSize = Math.min(16, Math.max(req.days * 4, 6));
  let rows = await findItineraryCandidates(resolvedArea, poolSize * 2);
  if (rows.length === 0) {
    return {
      text: `I couldn't find "${req.destination}" in Saafera's catalogue yet — check the spelling, try a nearby bigger town/district name, or browse Destinations directly.`,
      topPlace: null,
    };
  }
  rows = dedupeByLocation(rows).slice(0, poolSize);
  const withCoords = rows.filter(
    (r) => r.latitude && r.longitude && Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))
  );
  if (withCoords.length === 0) {
    return {
      text: `I have places in ${titleCase(req.destination)} in the catalogue but none with map coordinates yet, so I can't build a routed plan — try Destinations directly.`,
      topPlace: null,
    };
  }

  const coordsList: LatLng[] = withCoords.map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) }));
  const { orderedIdx, legs, totalDistanceKm } = await orderTripStops(origin, coordsList);
  const orderedPlaces = orderedIdx.map((i) => withCoords[i]);

  const stops: ItineraryStop[] = orderedPlaces.map((p, i) => ({
    placeId: p.id,
    name: p.name,
    category: p.category,
    imageUrl: p.imageUrl,
    entryFeePerPerson: p.entryFeePerPerson,
    idealMinutes:
      p.idealHoursAtPlace != null ? Math.max(15, Math.round(p.idealHoursAtPlace * 60)) : p.idealMinutesAtPlace ?? 60,
    lat: coordsList[orderedIdx[i]].lat,
    lng: coordsList[orderedIdx[i]].lng,
    arrivalKmFromPrev: legs[i]?.distanceKm ?? 0,
    arrivalMinutesFromPrev: legs[i]?.durationMinutes ?? 0,
  }));

  const dayBuckets = bucketStopsByDay(stops, req.days);

  const inBlr = origin ? isBengaluru(origin) : false;
  const fuelTotal = Math.round(travelCostFor("car", "small_car", totalDistanceKm, req.travellers, inBlr).cost);
  const entryFeesTotal = stops.reduce((sum, s) => sum + s.entryFeePerPerson * req.travellers, 0);
  const foodTotal = req.travellers * req.days * GROUP_FOOD_PER_PERSON_PER_DAY;
  const totalCost = fuelTotal + entryFeesTotal + foodTotal;
  const perPersonCost = Math.round(totalCost / Math.max(1, req.travellers));
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const lines: string[] = [];
  const dest = titleCase(req.destination);
  lines.push(
    `Here's a ${dayBuckets.length}-day plan for ${dest} (${req.travellers} traveller${req.travellers > 1 ? "s" : ""}), using real rated places from Saafera's catalogue:`
  );
  if (dayBuckets.length < req.days) {
    lines.push(
      `(Saafera's catalogue only has enough well-rated places here to fill ${dayBuckets.length} of the ${req.days} day${req.days > 1 ? "s" : ""} you asked for — browse Destinations for more in ${dest}.)`
    );
  }
  lines.push("");
  dayBuckets.forEach((day, i) => {
    lines.push(formatTripDay(day, i === 0), "");
  });
  lines.push(
    `**Estimated cost:** ${inr(totalCost)} total (${inr(perPersonCost)}/person) — ${inr(fuelTotal)} travel (car), ${inr(
      entryFeesTotal
    )} entry fees, ${inr(foodTotal)} food.`
  );
  if (!origin) {
    lines.push(
      "I don't have your live location yet (allow location access in your browser) — this plan doesn't include travel cost/distance from where you are, only movement between the stops themselves."
    );
  }
  if (req.budgetInr != null) {
    lines.push(
      totalCost <= req.budgetInr
        ? `This fits within your ₹${req.budgetInr.toLocaleString("en-IN")} budget.`
        : `This comes to ${inr(totalCost - req.budgetInr)} over your ₹${req.budgetInr.toLocaleString("en-IN")} budget — try fewer days/stops, or raise the budget.`
    );
  }
  lines.push("", "Open the Budget Planner or Group Trip Planner to fine-tune this, save it, or get live turn-by-turn directions.");

  return { text: lines.join("\n"), topPlace: orderedPlaces[0]?.name ?? null };
}

// ---------------------------------------------------------------------------
// Personal trip-plan data
// ---------------------------------------------------------------------------

function summarizeTripPlans(plans: TripPlanWithItems[]): string {
  if (plans.length === 0) {
    return "You don't have any saved trip plans yet — build one in the Budget Planner and it'll show up here.";
  }
  const lines = plans.slice(0, 5).map((p) => {
    const placeList = p.items.map((d) => d.name).join(", ") || "no places added yet";
    const perPerson = p.travellers > 0 ? Math.round(p.totalBudget / p.travellers) : p.totalBudget;
    return `- **${p.name}** — ${p.days} day(s), ₹${p.totalBudget.toLocaleString("en-IN")} budget (₹${perPerson.toLocaleString(
      "en-IN"
    )}/person), ${p.travellers} traveller(s), status: ${p.status}. Places: ${placeList}`;
  });
  return ["Your saved trip plans:", "", ...lines].join("\n");
}

// ---------------------------------------------------------------------------
// Canned, accurate answers about the product itself — every claim here is
// checked against the real feature set, including what's deliberately absent
// (car booking with a driver, user-submitted ratings, group voting).
// ---------------------------------------------------------------------------

const FAQ: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ["budget planner", "multi-stop", "how does the planner", "plan a trip", "how do i plan", "create a trip", "add multiple places", "two-day trip", "three-day trip", "two day trip", "three day trip"],
    answer:
      "The Budget Planner builds a full day-plan for you: pick a starting point (or use \"around me\" with live location, or choose an area), a total budget, hours/days, number of travellers, a vehicle (car/bike/bus/train/flight), a search radius/direction, and the kinds of places you want (temples, waterfalls, museums, parks, nightlife, etc.). It then works out which places to visit and in what order, using real driving distances and times, entry fees and food cost — and shows the full cost breakdown plus how car/bike/bus/train compare for the same trip. Increase \"days\" for a multi-day plan.",
  },
  {
    keywords: ["remove a place from my trip", "change the order", "reorder", "which place should i visit first", "which place should i visit last"],
    answer:
      "Once a plan is generated you can swap out any stop for one of the suggested alternatives. The visiting order and route itself are worked out automatically from real driving distances, not manually reordered.",
  },
  {
    keywords: ["save my trip", "edit a saved trip", "trip history", "past trip", "previous trip"],
    answer: "Trip History keeps every plan you've generated and saved, so you can revisit or reuse them later.",
  },
  {
    keywords: ["share my trip", "share this trip"],
    answer:
      "You can share a generated plan via your phone's share sheet (WhatsApp, Instagram, etc.) or copy it — it sends a text summary plus a Google Maps link for the route. There's no collaborative/editable shared-link feature yet.",
  },
  {
    keywords: ["group trip", "vote on places", "friends vote", "group of"],
    answer:
      "Saafera doesn't have built-in group voting on places. For a group trip, set the traveller count in the Budget Planner and share the resulting plan with your group to decide together.",
  },
  {
    keywords: ["live budget", "cost breakdown"],
    answer:
      "Live Budget is the running cost breakdown you see while building a plan in the Budget Planner — travel/fuel, entry fees and food, updated as you add or remove places, so you always see the total and per-person cost before you finish.",
  },
  {
    keywords: ["trip cart", "add to cart", "cart"],
    answer: "Trip Cart lets you save individual places you like while browsing, so you can build up a shortlist before turning it into a full plan.",
  },
  {
    keywords: ["favourite", "favorite", "wishlist", "saved tourist places"],
    answer: "Tap the heart/favourite icon on any place to save it — your saved places show up under Favourites.",
  },
  {
    keywords: ["search for a tourist place", "filter places by category", "filter places by state", "filter by district", "how do i find heritage places", "how do i find pilgrimage places", "how do i find adventure places", "how do i find wildlife places"],
    answer: "The Destinations page has search plus filters for category, state and district — use those to browse by the kind of place you want.",
  },
  {
    keywords: ["community", "post", "feed", "travel reels", "latest travel posts", "popular community posts"],
    answer: "Community is a social feed where travellers share trip posts (with photos) and can react/comment. You can edit or delete your own posts.",
  },
  {
    keywords: ["message another traveller", "message a traveller"],
    answer: "Yes — you can message other travellers directly from Community.",
  },
  {
    keywords: ["rate a tourist place", "review a tourist place", "reviews from other travellers"],
    answer:
      "Saafera doesn't have a user-submitted star-rating/review system — ratings shown on a place come from Google (synced periodically by the admin team), not from other travellers in the app.",
  },
  {
    keywords: ["report an incorrect place", "report a permanently closed place", "report a duplicate", "tell other users that a place is currently open"],
    answer:
      "There's no in-app \"report a place\" button right now. Closures and duplicates are cleaned up by the Saafera team from Google Places data and catalogue reviews.",
  },
  {
    keywords: ["add a new tourist place", "add my own tourist place", "contribute information about a tourist place"],
    answer: "You can't add a new destination to the main catalogue yourself yet — the catalogue is curated by the Saafera team.",
  },
  {
    keywords: ["add a local festival", "suggest a festival"],
    answer: "Yes — you can suggest a local festival from the Festivals page; an admin reviews it before it appears for everyone.",
  },
  {
    keywords: ["dark mode"],
    answer: "There's a theme toggle for dark mode in Settings/the top bar.",
  },
  {
    keywords: ["notifications"],
    answer: "Notifications live under Community — you'll find them there.",
  },
  {
    keywords: ["profile", "settings", "account"],
    answer: "Your Profile and Settings pages hold your account details and preferences.",
  },
  {
    keywords: [
      "book a car", "car booking", "book a driver", "car with a driver", "outstation trip", "book a tempo",
      "pickup location", "pickup date", "cancel a car booking", "driver charge", "fuel included in the car booking",
      "sedan or suv", "hatchback suitable", "which vehicle is suitable", "which car is suitable",
    ],
    answer:
      "Saafera doesn't book cars or drivers — there's no cab/car-booking service. The \"vehicle\" you pick in the Budget Planner (car/bike/bus/train/flight) is only used to estimate travel cost and time and to compare modes for your trip; you arrange your own transport.",
  },
  {
    keywords: ["book", "booking", "payment", "pay for", "accommodation"],
    answer:
      "Saafera doesn't book flights, hotels, cars or tickets, and doesn't take payments — it's a planning tool. It gives you the plan and the cost breakdown; you book everything yourself.",
  },
  {
    keywords: ["destinations", "catalogue", "catalog", "places list", "explore"],
    answer:
      "Destinations is Saafera's catalogue of thousands of curated places across India — temples, forts, waterfalls, hill stations, museums, lakes, markets and more — each with photos, entry fees, timings and a description, plus live nearby food/shopping spots.",
  },
];

const STATIC_TIPS: Array<{ words: string[]; answer: string }> = [
  {
    words: ["carry for a one-day trip", "carry for a day trip"],
    answer: "For a one-day trip: water, snacks, ID, cash and a card, a power bank, comfortable shoes, and sunscreen.",
  },
  {
    words: ["carry for a hill-station", "carry for a hill station"],
    answer: "For a hill-station trip: warm layers (evenings/mornings get cold year-round), a light rain jacket, comfortable walking shoes and any motion-sickness medicine for the ghat roads.",
  },
  {
    words: ["carry for a beach"],
    answer: "For a beach trip: sunscreen, sunglasses, a hat, light cotton clothing, flip-flops and a dry bag for your phone/wallet.",
  },
  {
    words: ["carry for a wildlife"],
    answer: "For a wildlife trip: neutral-coloured clothing, binoculars if you have them, insect repellent, and check the park's own timing/permit rules before you go.",
  },
  {
    words: ["check before starting a road trip", "road trip safety", "travel safety tips"],
    answer:
      "Before a road trip: check your vehicle's documents and fuel/charge, share your route with someone, carry a printed/offline copy of your plan in case of no signal, keep cash for tolls/small towns, and avoid driving unfamiliar ghat roads after dark.",
  },
];

const GREETING_WORDS = ["hi", "hello", "hey", "hii", "hola"];
const THANKS_WORDS = ["thank", "thanks", "thx"];
const TRIP_PLAN_WORDS = ["my trip", "my plan", "upcoming trip", "saved trip", "my saved", "how's my trip", "hows my trip", "selected several places", "total trip cost"];
const PLACE_FINDER_WORDS = [
  "best place", "best time", "climate", "weather", "season", "visit now",
  "recommend", "suggest", "which place", "which destination", "where should i go", "where to go", "this month",
  "place to visit", "places to visit", "where to visit", "what can i visit", "budget of", "good for a", "suitable for",
  "hidden", "less-crowded", "less crowded", "lesser-known", "lesser known", "offbeat",
  "food is famous", "local food", "what to eat", "restaurants near", "shopping place", "local products",
  "souvenirs", "what should i buy", "waterfalls in", "beaches in", "temples in", "hill stations in",
  "heritage places in", "pilgrimage places in", "wildlife destinations in", "adventure places in",
];
const FESTIVAL_WORDS = ["festival", "fair", "dasara", "ugadi", "deepavali", "diwali", "ganesh chaturthi", "jatre"];
// Signals a short question is asking for ONE MORE fact about a place rather
// than naming a new one — used only to decide whether a subject-less
// question should fall back to whatever place is already in context.
const ATTRIBUTE_FOLLOWUP_WORDS = [
  "entry fee", "fee", "fees", "ticket", "timing", "timings", "opening hour", "opening time",
  "is it open", "when does it open", "when does it close", "best time", "how long", "duration",
  "rating", "reviews", "category", "where is it", "located",
];

const ABOUT_SAAFERA = [
  "Saafera is a budget travel planning app for trips in India. The core feature is the Budget Planner: give it a starting point, budget, hours/days, number of travellers, a vehicle, a search radius and the kinds of places you want, and it builds a real day-plan — which places to visit and in what order, real driving distances/times, entry fees and food cost, and a full cost breakdown.",
  "It also has a catalogue of thousands of curated Destinations across India, Trip Cart and Trip History to save places and plans, Favourites, a Community feed, and a Festivals calendar.",
  "I'm the Saafera Assistant, built into the app — I can look up real places by category/area/season/budget/location, tell you about a specific destination, check on your saved trips, and answer how-to questions about the app.",
  "Saafera doesn't book flights, hotels or cars, and doesn't take payments — it's a planning tool, not a booking service.",
].join("\n\n");

const HELP_MESSAGE = [
  "Here's what you can ask me:",
  '- Plan a trip: "plan a trip to Goa for 2 days", "plan a 3 day trip to Hampi for 4 people"',
  '- Places to visit: "best places to visit in Coorg", "hidden waterfalls near Bengaluru", "temples in Karnataka"',
  '- Budget & location: "which places can I visit with ₹5,000", "what\'s near me", "places within 30 km"',
  '- A specific place: "tell me about Hampi", "entry fee for Mysore Palace", "how far is Coorg from Bengaluru"',
  '- Your trips: "my trip plans"',
  '- Festivals: "festivals this month"',
  '- The app itself: "how does the budget planner work", "how do I save a trip"',
].join("\n");

// The real answer to "how does Saafera handle duplicates/clustering/closures/
// etc." — every mechanism named here actually exists in the catalogue.
const DATA_MODEL_EXPLANATION =
  "Saafera keeps every destination, day-trip and city place in one unified `places` table rather than three separate ones — a place's `kinds` field says which catalogue(s) it belongs to. When two records turn out to be the same real place, one survives and the other's old slug is kept in `legacySlugs` so old links keep working, and the richer/curated row is preferred over a bulk-imported one when choosing which survives. District matching folds spelling variants (e.g. Bagalkot/Bagalkote, Bengaluru/Bangalore) without merging genuinely different districts like Bengaluru Rural vs Urban. Closures are tracked via `googleBusinessStatus`, synced periodically from Google — a permanently-closed place is filtered out of every list automatically. \"Nearby\" queries bound by real straight-line distance (with a road-distance factor applied for driving estimates), and route ordering in the Budget Planner uses real road distances, not just geography. Duplicate cleanup is done by the Saafera team using dedicated review scripts, not automatically merged without a human check when names only partially match.";

export interface AssistantContext {
  userId: string | null;
  origin: LatLng | null;
  // The place the last turn was about (a dossier, a distance answer, a
  // nearby-to-X lookup) — lets a short follow-up like "what's the entry fee?"
  // or "what's nearby?" work without repeating the name.
  contextPlace: string | null;
}

export interface AssistantReply {
  reply: string;
  // The place THIS turn resolved to, for the client to remember and send back
  // as `contextPlace` on the next turn. Null when the answer wasn't about one
  // specific place (a list, an FAQ, etc.) — a list is ambiguous to refer back
  // to with "it", so context is deliberately dropped rather than guessed.
  place: string | null;
  // Tappable follow-up questions, chosen so every one of them is guaranteed to
  // resolve to a real answer if sent as-is.
  suggestions: string[];
}

function reply(text: string, opts: { place?: string | null; suggestions?: string[] } = {}): AssistantReply {
  return { reply: text, place: opts.place ?? null, suggestions: opts.suggestions ?? [] };
}

const SUGG_DISCOVER = "Best places to visit this month";
const SUGG_NEARME = "What's near me?";
const SUGG_TRIPS = "My trip plans";
const SUGG_FEST = "Festivals this month";

function placeSuggestions(name: string): string[] {
  return [`What's near ${name}?`, "How far is it from me?"];
}

// Swap a trailing pronoun for the place the conversation is already about, so
// "how far is it from Bengaluru" or "what's the entry fee for that place"
// resolves without the traveller repeating the name.
const PRONOUN_RE = /\b(it|this place|that place|this destination|that destination|there)\b/gi;
function resolvePronouns(text: string, place: string | null): string {
  if (!place) return text;
  return text.replace(PRONOUN_RE, place);
}

export async function answerAssistantQuestion(rawQuestion: string, ctx: AssistantContext): Promise<AssistantReply> {
  const q = rawQuestion.trim().toLowerCase();
  if (!q) return reply("Ask me something about planning a trip, or how to use Saafera.", { suggestions: [SUGG_DISCOVER, SUGG_NEARME] });

  if (GREETING_WORDS.some((w) => q === w || q.startsWith(w + " ") || q.startsWith(w + "!"))) {
    return reply(
      "Hey! I can look up real places by season, budget or location, check on your saved trips, or explain how anything in the app works. What are you planning?",
      { suggestions: [SUGG_DISCOVER, SUGG_NEARME, SUGG_TRIPS, SUGG_FEST] }
    );
  }
  if (THANKS_WORDS.some((w) => q.includes(w))) {
    return reply("Anytime! Anything else about your trip or the app?", { suggestions: [SUGG_DISCOVER, SUGG_NEARME] });
  }

  if (q === "help" || q === "?" || /\b(what can i ask|what should i ask|what can you help)\b/.test(q)) {
    return reply(HELP_MESSAGE, { suggestions: [SUGG_DISCOVER, SUGG_NEARME, SUGG_TRIPS, SUGG_FEST] });
  }
  if (
    /\b(what is saafera|what's saafera|about saafera|what does saafera do|what is this app|what is this platform|who are you|what can (you|the saafera assistant) (do|help)|what do you do)\b/.test(
      q
    )
  ) {
    return reply(ABOUT_SAAFERA, { suggestions: [SUGG_DISCOVER, SUGG_NEARME, SUGG_TRIPS] });
  }

  // "Plan a trip to Goa for 2 days" — generate a real, routed day-by-day plan
  // rather than just explaining how the Budget Planner works. Checked before
  // the FAQ block below, since "plan a trip"/"two-day trip" are also FAQ
  // keywords there and would otherwise win first and only explain the feature
  // instead of actually doing it.
  const tripPlanRequest = parseTripPlanRequest(q);
  if (tripPlanRequest) {
    try {
      const answer = await answerTripPlanRequest(tripPlanRequest, ctx.origin);
      const suggestions = answer.topPlace ? [`Tell me about ${answer.topPlace}`, SUGG_NEARME] : [SUGG_NEARME];
      return reply(answer.text, { place: answer.topPlace, suggestions });
    } catch {
      return reply("I couldn't build that plan just now — try again in a moment, or use the Budget Planner directly.");
    }
  }

  if (TRIP_PLAN_WORDS.some((w) => q.includes(w))) {
    if (!ctx.userId) {
      return reply("You're not signed in, so I can't see personal trip plans — sign in to save and check on trips.", {
        suggestions: [SUGG_DISCOVER],
      });
    }
    try {
      return reply(summarizeTripPlans(await listUserTripPlans(ctx.userId)), { suggestions: [SUGG_DISCOVER, SUGG_NEARME] });
    } catch {
      return reply("I couldn't load your trip plans just now — try again in a moment.");
    }
  }

  const qResolved = resolvePronouns(q, ctx.contextPlace);

  // "How far is it from me?" — distance from the traveller's OWN location to
  // whatever place is still in context, not place-to-place.
  if (ctx.contextPlace && /\b(from me|from here)\b/.test(q) && /\b(how far|distance)\b/.test(q)) {
    if (!ctx.origin) {
      return reply("I don't have your live location yet — allow location access in your browser, then ask again.", {
        place: ctx.contextPlace,
      });
    }
    try {
      const found = await findOnePlace(ctx.contextPlace);
      const text = found ? answerDistanceFromMe(found.row, ctx.origin) : null;
      if (text) return reply(text, { place: ctx.contextPlace, suggestions: placeSuggestions(ctx.contextPlace) });
    } catch {
      /* fall through */
    }
  }

  // "How far is X from Y?"
  const distanceMatch = qResolved.match(/how far (?:is|are)\s+(.+?)\s+from\s+(.+?)[?.!]*$/i);
  if (distanceMatch) {
    try {
      const answer = await answerDistanceQuestion(distanceMatch[1].trim(), distanceMatch[2].trim());
      if (answer) return reply(answer.text, { place: answer.place, suggestions: placeSuggestions(answer.place) });
    } catch {
      /* fall through to other intents */
    }
  }

  // "What's near me?" / "within 30/60/100/150 km" — uses the traveller's real
  // live location, checked before the named-place version below so "near me"
  // never gets treated as a place literally called "me".
  const withinKmMatch = q.match(/within\s+(\d+)\s*km/i);
  if (/\b(near me|around me|close to me|my (current )?location|closest to my current location)\b/.test(q) || withinKmMatch) {
    if (!ctx.origin) {
      return reply(
        "I don't have your live location yet — allow location access in your browser (open the chat again after granting it), then ask me this again."
      );
    }
    try {
      const radiusKm = withinKmMatch ? Math.min(500, Math.max(1, Number(withinKmMatch[1]))) : 50;
      const category = detectCategory(q);
      const budgetInr = parseBudgetInr(q);
      const rows = await findPlaces({ category, near: { origin: ctx.origin, radiusKm }, limit: 30 });
      let ranked = rankPlaces(rows, ctx.origin).filter((p) => p.distanceKm != null && p.distanceKm <= radiusKm);
      ranked.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      const notes: string[] = [];
      if (budgetInr != null) {
        const applied = applyBudget(ranked, budgetInr, true);
        ranked = applied.ranked;
        if (applied.note) notes.push(applied.note);
      }
      ranked = ranked.slice(0, 5);
      if (ranked.length === 0) {
        return reply(`I couldn't find catalogued places within ${radiusKm} km of your location.`, { suggestions: [SUGG_DISCOVER] });
      }
      const top = ranked[0].name;
      return reply([...notes, `Places within ${radiusKm} km of you:`, "", ...ranked.map(formatPlace)].filter(Boolean).join("\n"), {
        place: top,
        suggestions: [`Tell me about ${top}`, SUGG_FEST],
      });
    } catch {
      return reply("I couldn't look up nearby places just now — try again in a moment.");
    }
  }

  // "...near X" / "...around X" anywhere in the question (not just right
  // after the word "places") — e.g. "best places to visit near Mysore
  // Palace". Only treated as a specific attraction if X actually resolves
  // strongly to one via the catalogue's own search ranking; otherwise it
  // falls through to the area-based place-finder below (extractArea() picks
  // up the same "near X" text as a district/city/state match instead). The
  // category, if any, is detected from the text BEFORE "near/around" only —
  // so "near Mysore Palace" can't have its own name ("...palace") misread as
  // a request for Heritage-category places.
  const nearIdx = qResolved.search(/\b(?:near|around)\s+/i);
  if (nearIdx === -1 && ctx.contextPlace && /\b(nearby|around here|close by)\b/.test(q)) {
    // No explicit target, but the conversation is already about a place —
    // "what's nearby?" right after asking about Hampi means nearby Hampi.
    try {
      const budgetInr = parseBudgetInr(q);
      const answer = await answerNearbyToPlace(ctx.contextPlace, ctx.origin, budgetInr, null);
      if (answer) return reply(answer.text, { place: answer.place, suggestions: placeSuggestions(answer.place) });
    } catch {
      /* fall through */
    }
  }
  if (nearIdx !== -1) {
    const nearTarget = qResolved.slice(nearIdx).replace(/^(?:near|around)\s+/i, "").replace(/[?.!]+$/, "").trim();
    if (nearTarget.length >= 3) {
      try {
        const budgetInr = parseBudgetInr(q);
        const category = detectCategory(qResolved.slice(0, nearIdx));
        const answer = await answerNearbyToPlace(nearTarget, ctx.origin, budgetInr, category);
        if (answer) return reply(answer.text, { place: answer.place, suggestions: placeSuggestions(answer.place) });
      } catch {
        /* fall through to the area-based place-finder */
      }
    }
  }

  // "How should/does Saafera handle/identify/store/decide/prevent/rank X?" —
  // questions about the catalogue's own data model. Answered from the real
  // mechanisms in this codebase, not a guess.
  if (/^how (should|does|do you|would you)\s+(saafera\s+)?(handle|identify|store|decide|prevent|rank|distinguish|represent|verify|choose|calculate|select|explain)/.test(q)) {
    return reply(DATA_MODEL_EXPLANATION);
  }

  if (FESTIVAL_WORDS.some((w) => q.includes(w))) {
    try {
      return reply(await answerFestivalQuestion(q), { suggestions: [SUGG_DISCOVER, SUGG_NEARME] });
    } catch {
      return reply("I couldn't look up festivals just now — try again in a moment.");
    }
  }

  if (PLACE_FINDER_WORDS.some((w) => q.includes(w))) {
    try {
      const answer = await answerPlaceFinder(q, ctx.origin);
      const suggestions = answer.topPlace ? [`Tell me about ${answer.topPlace}`, SUGG_NEARME] : [SUGG_NEARME, SUGG_FEST];
      return reply(answer.text, { place: answer.topPlace, suggestions });
    } catch {
      return reply("I couldn't look up places just now — try again in a moment.");
    }
  }

  for (const tip of STATIC_TIPS) {
    if (tip.words.some((w) => q.includes(w))) return reply(tip.answer);
  }

  const faq = FAQ.find((entry) => entry.keywords.some((k) => q.includes(k)));
  if (faq) return reply(faq.answer);

  // Last resort: does this look like a question about ONE specific place?
  // Try the question as typed first, then with any pronoun resolved against
  // context ("how far is it from Mysuru?").
  try {
    const dossier = (await answerPlaceDossier(q)) ?? (qResolved !== q ? await answerPlaceDossier(qResolved) : null);
    if (dossier) return reply(dossier.text, { place: dossier.place, suggestions: placeSuggestions(dossier.place) });
  } catch {
    /* fall through */
  }

  // A short, subject-less attribute question — "what's the entry fee?", "is
  // it open now?", "best time to visit?" — has nothing of its own for
  // dossierCandidates to search on, so the two attempts above both come back
  // empty. Rather than surface the generic fallback (or worse, risk a stray
  // leftover token spuriously matching an unrelated place), answer directly
  // about whatever place is already in context.
  if (ctx.contextPlace && ATTRIBUTE_FOLLOWUP_WORDS.some((w) => q.includes(w))) {
    try {
      const dossier = await answerPlaceDossier(ctx.contextPlace);
      if (dossier) return reply(dossier.text, { place: dossier.place, suggestions: placeSuggestions(dossier.place) });
    } catch {
      /* fall through to the generic help message */
    }
  }

  return reply("I didn't quite catch that — here's what tends to work well:", {
    suggestions: [SUGG_DISCOVER, SUGG_NEARME, "Tell me about Hampi", SUGG_TRIPS],
  });
}
