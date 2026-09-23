import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { visibleWhere } from "@/lib/queries/places";
import { listUserTripPlans, type TripPlanWithItems } from "@/lib/queries/trip-plans";
import { haversineKm, type LatLng } from "@/lib/geo";
import { isBengaluru, travelCostFor } from "@/lib/transport";

// The Saafera Assistant answers from two sources only, never a generative
// model: (1) this hard-coded, accurate description of what the app actually
// does, and (2) real rows from the `places` table (popularity, ratings, and
// the curated `bestMonths` field). No external API, so it can never invent a
// feature or a place that doesn't exist — every named place it recommends
// comes back from a live database query.

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// Free-text hints -> the exact `places.category` value they map to (matches
// the vocabulary used by the destinations admin form / DEST_CATEGORY_TO_OVERPASS).
const CATEGORY_HINTS: Array<{ words: string[]; category: string }> = [
  { words: ["beach", "sea", "coast", "coastal"], category: "Beach" },
  { words: ["hill station", "hill", "mountain", "cold", "snow", "cool weather"], category: "Hill Station" },
  { words: ["temple", "pilgrim", "shrine"], category: "Temple" },
  { words: ["waterfall", "falls"], category: "Waterfall" },
  { words: ["museum"], category: "Museum" },
  { words: ["park", "garden"], category: "Park" },
  { words: ["lake"], category: "Lake" },
  { words: ["heritage", "fort", "palace", "monument"], category: "Heritage" },
  { words: ["adventure", "trek", "trekking"], category: "Adventure" },
  { words: ["market", "shopping"], category: "Market" },
];

function detectCategory(question: string): string | null {
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((w) => question.includes(w))) return hint.category;
  }
  return null;
}

// "5k", "₹5000", "rs 5,000", "5000 rupees", "budget of 5000" — only matches an
// explicit money mention, never a bare number, so "5 best places" isn't
// mistaken for a ₹5 budget.
function parseBudgetInr(question: string): number | null {
  const patterns = [
    /₹\s*([\d,]+(?:\.\d+)?)\s*(k)?/i,
    /\brs\.?\s*([\d,]+(?:\.\d+)?)\s*(k)?/i,
    /\bbudget(?:\s+of)?\s+(?:₹|rs\.?)?\s*([\d,]+(?:\.\d+)?)\s*(k)?/i,
    /\b([\d,]+(?:\.\d+)?)\s*(?:rupees|inr)\b/i,
    /\b([\d,]+(?:\.\d+)?)\s*k\b/i,
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

interface SeasonalPlace {
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

interface RankedPlace extends SeasonalPlace {
  distanceKm: number | null;
  // Cheapest realistic round-trip fare (bus or train, whichever is lower),
  // using the same per-km rates as the real Budget Planner — null when we
  // don't know the traveller's location.
  travelCostInr: number | null;
}

const FOOD_RESERVE_PER_DAY = 350; // matches the planner's own meals estimate

async function findSeasonalPlaces(category: string | null, limit = 8): Promise<SeasonalPlace[]> {
  const monthAbbr = MONTH_ABBR[new Date().getMonth()];
  const columns = {
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
  const conditions = [
    eq(places.isHidden, false),
    sql`${places.bestMonths} IS NOT NULL AND ${places.bestMonths} LIKE ${"%" + monthAbbr + "%"}`,
  ];
  if (category) conditions.push(eq(places.category, category));

  const rows = await db
    .select(columns)
    .from(places)
    .where(visibleWhere(...conditions))
    .orderBy(sql`${places.googleRating} DESC NULLS LAST`, sql`${places.popularity} DESC`)
    .limit(limit);

  if (rows.length > 0) return rows;

  // Nothing curated for this month/category combo — fall back to popular
  // places overall (still real data) rather than an empty answer.
  return db
    .select(columns)
    .from(places)
    .where(visibleWhere(eq(places.isHidden, false), category ? eq(places.category, category) : undefined))
    .orderBy(sql`${places.popularity} DESC`)
    .limit(limit);
}

// Cheapest of bus/train per-person fare for the round trip, using the exact
// same fare-per-km data the Budget Planner itself uses — never a made-up
// number. Reused here so a place a traveller genuinely can't afford to reach
// is never suggested.
function estimateRoundTripCost(origin: LatLng, dest: LatLng): { distanceKm: number; costInr: number } {
  const distanceKm = haversineKm(origin, dest);
  const roundTripKm = distanceKm * 2;
  const inBlr = isBengaluru(origin);
  const bus = travelCostFor("bus", "small_car", roundTripKm, 1, inBlr).cost;
  const train = travelCostFor("train", "small_car", roundTripKm, 1, inBlr).cost;
  return { distanceKm, costInr: Math.min(bus, train) };
}

function rankPlaces(rows: SeasonalPlace[], origin: LatLng | null): RankedPlace[] {
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

function formatSeasonalPlace(p: RankedPlace): string {
  const location = [p.district, p.state].filter(Boolean).join(", ");
  const rating = p.googleRating ? ` (★${p.googleRating.toFixed(1)})` : "";
  const fee = p.entryFeePerPerson > 0 ? `entry ₹${p.entryFeePerPerson}/person` : "free entry";
  const distance = p.distanceKm != null ? `, ~${Math.round(p.distanceKm)} km from you` : "";
  const travel =
    p.travelCostInr != null ? `, ~₹${p.travelCostInr.toLocaleString("en-IN")} round trip by bus/train` : "";
  return `- **${p.name}**${rating}${location ? ` — ${location}` : ""}${distance}, ${fee}${travel}. ${p.shortDescription}`;
}

async function answerSeasonalQuestion(question: string, origin: LatLng | null): Promise<string> {
  const category = detectCategory(question);
  const budgetInr = parseBudgetInr(question);
  const monthName = new Date().toLocaleDateString("en-IN", { month: "long" });

  const rows = await findSeasonalPlaces(category);
  if (rows.length === 0) {
    return "I couldn't find any places matching that in Saafera's catalogue yet — try browsing Destinations or asking about a different category.";
  }

  let ranked = rankPlaces(rows, origin);
  const notes: string[] = [];

  if (budgetInr != null) {
    if (origin) {
      const affordable = ranked.filter(
        (p) => p.travelCostInr == null || p.travelCostInr + p.entryFeePerPerson + FOOD_RESERVE_PER_DAY <= budgetInr
      );
      if (affordable.length > 0) {
        ranked = affordable;
        // Nearest/cheapest first — the point of stating a tight budget.
        ranked.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      } else {
        notes.push(
          `Nothing in this month's picks fits a ₹${budgetInr.toLocaleString("en-IN")} budget from your location (round-trip travel alone would cost more) — showing the cheapest-to-reach options instead so you can see how much you'd need.`
        );
        ranked.sort((a, b) => (a.travelCostInr ?? Infinity) - (b.travelCostInr ?? Infinity));
      }
    } else {
      // No location — can only screen by entry fee, not real travel cost.
      ranked = ranked.filter((p) => p.entryFeePerPerson <= budgetInr);
      notes.push(
        "I don't have your live location yet (allow location access in your browser), so this doesn't account for travel cost to get there — only entry fees."
      );
      if (ranked.length === 0) ranked = rankPlaces(rows, origin);
    }
  } else if (origin) {
    // Location known, no stated budget — nearest first is still the most
    // actionable ordering.
    ranked.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  ranked = ranked.slice(0, 5);

  const heading = category
    ? `Good ${category.toLowerCase()} picks for ${monthName}${budgetInr ? ` within ₹${budgetInr.toLocaleString("en-IN")}` : ""}:`
    : `Places rated best to visit right now (${monthName})${budgetInr ? `, within ₹${budgetInr.toLocaleString("en-IN")}` : ""}:`;

  return [...notes, heading, "", ...ranked.map(formatSeasonalPlace)].filter(Boolean).join("\n");
}

function summarizeTripPlans(plans: TripPlanWithItems[]): string {
  if (plans.length === 0) {
    return "You don't have any saved trip plans yet — build one in the Budget Planner and it'll show up here.";
  }
  const lines = plans.slice(0, 5).map((p) => {
    const placeList = p.items.map((d) => d.name).join(", ") || "no places added yet";
    return `- **${p.name}** — ${p.days} day(s), ₹${p.totalBudget.toLocaleString("en-IN")} budget, ${p.travellers} traveller(s), status: ${p.status}. Places: ${placeList}`;
  });
  return ["Your saved trip plans:", "", ...lines].join("\n");
}

// Canned, accurate answers about the product itself — never guesses at a
// feature that doesn't exist.
const FAQ: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ["budget planner", "multi-stop", "how does the planner", "plan a trip", "how do i plan"],
    answer:
      "The Budget Planner builds a full day-plan for you: pick a starting point (or use \"around me\" with live location, or choose an area), a total budget, hours/days, number of travellers, a vehicle (car/bike/bus/train/flight), a search radius/direction, and the kinds of places you want (temples, waterfalls, museums, parks, nightlife, etc.). It then works out which places to visit and in what order, using real driving distances and times, entry fees and food cost — and shows you the full cost breakdown plus how car/bike/bus/train compare for the same trip.",
  },
  {
    keywords: ["trip cart", "add to cart", "cart"],
    answer:
      "Trip Cart lets you save individual places you like while browsing, so you can build up a shortlist before turning it into a full plan.",
  },
  {
    keywords: ["trip history", "past trip", "previous trip"],
    answer: "Trip History keeps every plan you've generated and saved, so you can revisit or reuse them later.",
  },
  {
    keywords: ["favourite", "favorite", "wishlist"],
    answer: "Tap the heart/favourite icon on any place to save it — your saved places show up under Favourites.",
  },
  {
    keywords: ["community", "post", "feed"],
    answer: "Community is a social feed where travellers share trip posts and message each other.",
  },
  {
    keywords: ["destinations", "catalogue", "catalog", "places list", "explore"],
    answer:
      "Destinations is Saafera's catalogue of thousands of curated places across India — temples, forts, waterfalls, hill stations, museums, lakes, markets and more — each with photos, entry fees, timings and a description, plus live nearby food/shopping spots.",
  },
  {
    keywords: ["profile", "settings", "account"],
    answer: "Your Profile and Settings pages hold your account details and preferences.",
  },
  {
    keywords: ["book", "booking", "payment", "pay"],
    answer:
      "Saafera doesn't book flights, hotels or tickets, and doesn't take payments — it's a planning tool. It gives you the plan and the cost breakdown; you book everything yourself.",
  },
];

function matchFaq(question: string): string | null {
  for (const entry of FAQ) {
    if (entry.keywords.some((k) => question.includes(k))) return entry.answer;
  }
  return null;
}

const GREETING_WORDS = ["hi", "hello", "hey", "hii", "hola"];
const THANKS_WORDS = ["thank", "thanks", "thx"];
const TRIP_PLAN_WORDS = ["my trip", "my plan", "upcoming trip", "saved trip", "my saved", "how's my trip", "hows my trip"];
const SEASONAL_WORDS = [
  "best place", "best time", "climate", "weather", "season", "visit now",
  "recommend", "suggest", "which place", "where should i go", "where to go", "this month",
  "place to visit", "places to visit", "where to visit", "what can i visit", "budget of",
];

export interface AssistantContext {
  userId: string | null;
  origin: LatLng | null;
}

export async function answerAssistantQuestion(rawQuestion: string, ctx: AssistantContext): Promise<string> {
  const q = rawQuestion.trim().toLowerCase();
  if (!q) return "Ask me something about planning a trip, or how to use Saafera.";

  if (GREETING_WORDS.some((w) => q === w || q.startsWith(w + " ") || q.startsWith(w + "!"))) {
    return "Hi! I can tell you how to use Saafera, look up your saved trips, or suggest real places to visit based on the season. What do you need?";
  }
  if (THANKS_WORDS.some((w) => q.includes(w))) {
    return "You're welcome! Anything else about your trip or the app?";
  }

  if (TRIP_PLAN_WORDS.some((w) => q.includes(w))) {
    if (!ctx.userId) return "You're not signed in, so I can't see personal trip plans — sign in to save and check on trips.";
    try {
      const plans = await listUserTripPlans(ctx.userId);
      return summarizeTripPlans(plans);
    } catch {
      return "I couldn't load your trip plans just now — try again in a moment.";
    }
  }

  if (SEASONAL_WORDS.some((w) => q.includes(w))) {
    try {
      return await answerSeasonalQuestion(q, ctx.origin);
    } catch {
      return "I couldn't look up seasonal picks just now — try again in a moment.";
    }
  }

  const faq = matchFaq(q);
  if (faq) return faq;

  return "I can help with two things: how to use Saafera (Budget Planner, Trip Cart, Favourites, Community, Trip History), or suggesting real places to visit based on the season — try asking something like \"best places to visit in December\" or \"how does the budget planner work\".";
}
