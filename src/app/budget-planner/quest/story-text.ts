// Narrative helpers for the Trip Planner's story flow. Pure functions — every
// sentence is built from the plan's REAL numbers (distance, time, cost); only the
// wording around them is playful.

export type Kind = "temple" | "waterfall" | "water" | "hill" | "fort" | "wild" | "food" | "shop" | "wander";

const RULES: [RegExp, Kind][] = [
  [/waterfall|falls?\b|cascade/, "waterfall"],
  [/temple|mandir|church|mosque|masjid|gurudwara|basilica|shrine|dargah|pilgrim|devasthana|ashram|\bmath\b/, "temple"],
  [/lake|dam\b|river|reservoir|backwater|\btank\b|kere|beach|coast|\bsea\b|island/, "water"],
  [/hill|peak|trek|mountain|ghat|view ?point|betta|giri|valley|pass\b|summit|sunrise|sunset/, "hill"],
  [/fort|palace|heritage|museum|monument|ruins|tomb|castle|archaeolog|histor/, "fort"],
  [/wildlife|safari|national park|sanctuary|\bzoo\b|forest|reserve|tiger|elephant|bird|nature|garden|\bpark\b/, "wild"],
  [/restaurant|caf[eé]|food|dhaba|bakery|eatery|\bhotel\b|\bmess\b|kitchen|biryani|dosa|coffee|tiffin/, "food"],
  [/mall|market|shopping|bazaar|emporium/, "shop"],
];

export function kindOf(category: string, name: string): Kind {
  const text = `${category} ${name}`.toLowerCase();
  for (const [re, k] of RULES) if (re.test(text)) return k;
  return "wander";
}

export const KIND_EMOJI: Record<Kind, string> = {
  temple: "🛕",
  waterfall: "💦",
  water: "🌊",
  hill: "⛰️",
  fort: "🏰",
  wild: "🌿",
  food: "🍛",
  shop: "🛍️",
  wander: "📍",
};

export const KIND_LABEL: Record<Kind, string> = {
  temple: "A quiet blessing",
  waterfall: "A wild water-song",
  water: "A still, shining place",
  hill: "A climb with a view",
  fort: "A page of history",
  wild: "A green hush",
  food: "A delicious detour",
  shop: "A market maze",
  wander: "A happy surprise",
};

const TEDDY: Record<Kind, string[]> = {
  temple: [
    "Teddy tiptoes in as the bells hum — {name} feels hushed and golden.",
    "At {name}, Teddy lights a tiny wish and the lantern glows a little brighter.",
    "Incense, bells and cool stone floors: {name} slows the whole world down.",
  ],
  waterfall: [
    "The roar of {name} reaches Teddy long before the mist does. He grins and gets soaked.",
    "Rainbows hide in the spray at {name}; Teddy chases every single one.",
    "Teddy stands at {name} and forgets, for one whole minute, to speak.",
  ],
  water: [
    "At {name}, Teddy skips stones and the water skips right back.",
    "{name} shimmers like spilled coins — a perfect place to sit and do nothing.",
    "Teddy dips his paws into {name} and declares it the best seat in the house.",
  ],
  hill: [
    "The path to {name} winds up and up; the view says it was worth every step.",
    "Teddy plants his lantern on top of {name} and the whole valley glows.",
    "Wind, sky and one very small bear at {name}. Heaven.",
  ],
  fort: [
    "{name} remembers kings and cannon-fire; Teddy salutes the old stones.",
    "Juno traces the walls of {name} on her map while Teddy hunts for secret doors.",
    "Every arch at {name} has a story. Teddy collects as many as he can carry.",
  ],
  wild: [
    "Something rustles in the green around {name}. Teddy whispers; Pip hoots softly back.",
    "At {name}, the forest keeps its own time — and Teddy happily keeps it too.",
    "Leaves, birdsong and dappled light at {name}. Nobody checks the clock.",
  ],
  food: [
    "Stop! {name} smells far too good to pass. Teddy's tummy votes yes, loudly.",
    "A table, a hot plate and {name}: the finest chapter of the day.",
    "Teddy declares {name} the official snack stop of the expedition.",
  ],
  shop: [
    "{name} is a maze of colour; Teddy leaves with one more souvenir than planned.",
    "Juno haggles, Pip winces, Teddy points at everything in {name}.",
    "Bells, bangles and bargains: {name} is a small festival of its own.",
  ],
  wander: [
    "Teddy wanders into {name} and the road quietly rewrites the day.",
    "{name} was never on a postcard — which makes it perfect.",
    "Juno marks {name} with a tiny star; Teddy marks it with a happy sigh.",
  ],
};

export function teddyLine(kind: Kind, name: string, i: number): string {
  const set = TEDDY[kind];
  return set[i % set.length].replace("{name}", name);
}

export function fmtMinutes(m: number): string {
  const n = Math.max(0, Math.round(m));
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function fmtKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export const DAY_NAMES = ["The First Dawn", "The Second Sun", "The Third Horizon", "The Fourth Sky", "The Fifth Light", "The Sixth Wind", "The Seventh Star"];

export interface StoryStop {
  id: string;
  name: string;
  category: string;
  entryFee: number;
  idealMinutes: number;
  stopCost: number;
  arrivalKmFromPrev: number;
  arrivalMinutesFromPrev: number;
  imageUrl?: string | null;
  rating?: number | null;
  /** Set for catalogue places; lets the story link a chapter to the place's own page. */
  meta?: { citySeedSlug?: string };
}

/** Split the stops across the trip's days by cumulative time, like the planner's own hours-per-day budget. */
export function assignDays(stops: StoryStop[], days: number, hours: number): number[] {
  const perDay = Math.max(60, (hours * 60) / Math.max(1, days));
  let cum = 0;
  return stops.map((s) => {
    const day = Math.min(days - 1, Math.floor(cum / perDay));
    cum += s.arrivalMinutesFromPrev + s.idealMinutes;
    return Math.max(0, day);
  });
}
