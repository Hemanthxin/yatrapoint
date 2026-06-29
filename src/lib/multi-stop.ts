// Pure greedy multi-stop selection. Takes candidates + constraints, returns
// a list of stops that fit. The caller then runs OSRM /trip on the picks to
// get an optimised order + real driving distance.

import type { LatLng } from "./geo";
import { haversineKm } from "./geo";
import type { OverpassCategory, OverpassPlace } from "./overpass";
import { VEHICLES, type VehicleKind } from "./budget";

// Per-category sensible defaults when OSM tells us nothing specific.
export const CATEGORY_DEFAULTS: Record<
  OverpassCategory,
  { entryFee: number; idealMinutes: number; foodCostPerPerson?: number }
> = {
  restaurant: { entryFee: 0, idealMinutes: 60, foodCostPerPerson: 350 },
  cafe: { entryFee: 0, idealMinutes: 45, foodCostPerPerson: 200 },
  fast_food: { entryFee: 0, idealMinutes: 30, foodCostPerPerson: 200 },
  nightlife: { entryFee: 0, idealMinutes: 120, foodCostPerPerson: 800 },
  mall: { entryFee: 0, idealMinutes: 90 },
  marketplace: { entryFee: 0, idealMinutes: 45 },
  temple: { entryFee: 0, idealMinutes: 30 },
  church: { entryFee: 0, idealMinutes: 30 },
  mosque: { entryFee: 0, idealMinutes: 30 },
  gurudwara: { entryFee: 0, idealMinutes: 30 },
  place_of_worship: { entryFee: 0, idealMinutes: 30 },
  park: { entryFee: 0, idealMinutes: 60 },
  garden: { entryFee: 50, idealMinutes: 60 },
  museum: { entryFee: 100, idealMinutes: 90 },
  viewpoint: { entryFee: 30, idealMinutes: 45 },
  monument: { entryFee: 25, idealMinutes: 45 },
  fort: { entryFee: 25, idealMinutes: 60 },
  lake: { entryFee: 0, idealMinutes: 45 },
  tourist_attraction: { entryFee: 25, idealMinutes: 60 },
  cinema: { entryFee: 250, idealMinutes: 180 },
  theatre: { entryFee: 300, idealMinutes: 150 },
  zoo: { entryFee: 200, idealMinutes: 120 },
  amusement: { entryFee: 500, idealMinutes: 240 },
};

// Internal candidate used by the planner — covers both Overpass and seeded
// places. The planner doesn't care about the source.
export interface Candidate {
  id: string;
  name: string;
  category: OverpassCategory;
  lat: number;
  lng: number;
  entryFee: number;
  // True only when the fee is REAL (OSM fee/charge tag or admin-curated). When
  // false we don't know the fee — we never invent one.
  entryFeeKnown?: boolean;
  idealMinutes: number;
  foodCostPerPerson?: number;
  // 0..100, used to break ties when distance is similar.
  popularity?: number;
  // When true, the traveller hand-picked this exact place — the planner pulls
  // it in ahead of auto-discovered candidates (budget/time permitting).
  pinned?: boolean;
  // Pass-through metadata so the UI can render extra info.
  meta?: {
    osmId?: string;
    citySeedSlug?: string;
    tags?: OverpassPlace["tags"];
  };
}

// Resolve a REAL entry fee from OSM tags. Returns the amount when mapped,
// 0 when explicitly free, or { known: false } when OSM doesn't say.
export function resolveOsmFee(tags?: OverpassPlace["tags"]): {
  known: boolean;
  amount: number;
} {
  if (!tags) return { known: false, amount: 0 };
  // `charge` carries the actual price, e.g. "20", "₹50", "30 INR".
  if (tags.charge) {
    const m = tags.charge.replace(/,/g, "").match(/\d+(\.\d+)?/);
    if (m) return { known: true, amount: Math.round(Number(m[0])) };
  }
  if (tags.fee === "no") return { known: true, amount: 0 };
  // fee=yes with no charge → it costs something, but the amount is unknown.
  return { known: false, amount: 0 };
}

export function candidateFromOverpass(p: OverpassPlace): Candidate {
  const def = CATEGORY_DEFAULTS[p.category];
  const fee = resolveOsmFee(p.tags);
  return {
    id: `osm:${p.osmId}`,
    name: p.name,
    category: p.category,
    entryFee: fee.amount,
    entryFeeKnown: fee.known,
    lat: p.lat,
    lng: p.lng,
    idealMinutes: def.idealMinutes,
    foodCostPerPerson: def.foodCostPerPerson,
    meta: { osmId: p.osmId, tags: p.tags },
  };
}

export interface PlannerInput {
  start: LatLng;
  totalBudget: number; // INR for the whole trip
  hoursAvailable: number;
  people: number;
  vehicle: VehicleKind;
  // If true, allow one food stop (cafe / restaurant) — adds food cost per person.
  includeFood: boolean;
  maxStops?: number;
  candidates: Candidate[];
  // Average urban driving speed in km/h. Used when no OSRM data is available
  // during the picking phase (we refine timings via OSRM /trip afterwards).
  avgSpeedKmh?: number;
  // The radius (km) the traveller chose. The planner spreads stops across
  // near/mid/far distance bands of this reach, so a bigger radius produces a
  // genuinely wider-ranging trip instead of the same nearby cluster.
  reachKm?: number;
}

export interface PlannerStop extends Candidate {
  arrivalKmFromPrev: number;
  arrivalMinutesFromPrev: number;
  stopCost: number; // INR — entry × people + (food if applicable)
  travelCost: number; // INR — fuel for the leg
}

export interface PlannerResult {
  stops: PlannerStop[];
  totalDistanceKm: number;
  totalMinutes: number;
  totalCost: number;
  perPersonCost: number;
  // Sum of total minutes at places + travel minutes. Useful for UI.
  unspentBudget: number;
  unspentMinutes: number;
}

type Pt = { lat: number; lng: number };

function isFoodCat(c: Candidate): boolean {
  return c.category === "restaurant" || c.category === "cafe" || c.category === "fast_food";
}

// 2-opt: repeatedly uncross the loop (start → … → start) by reversing the
// segment between two edges whenever doing so shortens the total distance.
// Turns the greedy pick order into an efficient, backtrack-free route.
function twoOpt(tour: Candidate[], start: Pt, D: (a: Pt, b: Pt) => number): void {
  if (tour.length < 3) return;
  const path: Pt[] = [start, ...tour, start];
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 1; i < path.length - 2; i++) {
      for (let k = i + 1; k < path.length - 1; k++) {
        const a = path[i - 1];
        const b = path[i];
        const c = path[k];
        const d = path[k + 1];
        // Swapping edges (a-b, c-d) → (a-c, b-d) means reversing b…c.
        const delta = D(a, c) + D(b, d) - (D(a, b) + D(c, d));
        if (delta < -1e-9) {
          let lo = i;
          let hi = k;
          while (lo < hi) {
            const t = path[lo];
            path[lo] = path[hi];
            path[hi] = t;
            lo++;
            hi--;
          }
          improved = true;
        }
      }
    }
  }
  for (let i = 0; i < tour.length; i++) tour[i] = path[i + 1] as Candidate;
}

// Intelligent multi-stop planner — an Orienteering-Problem solver. Instead of
// blindly hopping to the nearest place, it INSERTS the place with the best
// "value per extra detour" into the best position in the growing route, keeping
// inside the time + budget limits, then 2-opt optimises the final loop. Result:
// a compact, high-value, well-ordered day out rather than a zig-zag.
export function planMultiStop(input: PlannerInput): PlannerResult {
  const speed = input.avgSpeedKmh ?? 28; // urban driving baseline
  const v = VEHICLES[input.vehicle];
  const people = Math.max(1, input.people);
  const maxStops = input.maxStops ?? 6;
  const start: Pt = input.start;

  // 15% buffer of time for traffic + breaks.
  const minutesBudget = input.hoursAvailable * 60 * 0.85;
  const budget = input.totalBudget;

  const D = (a: Pt, b: Pt) => haversineKm(a, b);
  const stopCostOf = (c: Candidate) =>
    c.entryFee * people + (isFoodCat(c) ? (c.foodCostPerPerson ?? 0) * people : 0);

  // Distance band of a place within the chosen reach: 0 = near, 1 = mid,
  // 2 = far. Used to spread the trip across the whole radius.
  const reachKm = input.reachKm && input.reachKm > 0 ? input.reachKm : 0;
  const bandOf = (c: Candidate) =>
    reachKm ? Math.min(2, Math.floor(haversineKm(start, { lat: c.lat, lng: c.lng }) / (reachKm / 3))) : 0;
  const coveredBands = new Set<number>();

  // Worth of a place: base + popularity, a big bonus for a not-yet-covered
  // category (keeps the trip diverse), a bonus for reaching a not-yet-covered
  // distance band (uses the chosen radius), and a decisive boost for hand-picked
  // places so they always make the cut.
  const valueOf = (c: Candidate, covered: Set<string>) => {
    let val = 10 + (c.popularity ?? 50);
    if (!covered.has(c.category)) val += 60;
    if (reachKm && !coveredBands.has(bandOf(c))) val += 45;
    if (c.pinned) val += 1_000_000;
    return val;
  };

  const tour: Candidate[] = [];
  const covered = new Set<string>();
  let foodUsed = false;
  let curDist = 0; // round-trip distance of the current loop (incl. return)
  let curStopMin = 0;
  let curStopCost = 0;

  // Detour added by inserting c between position pos-1 and pos (start anchors
  // both ends of the loop).
  const detourAt = (c: Candidate, pos: number) => {
    const a = pos === 0 ? start : tour[pos - 1];
    const b = pos === tour.length ? start : tour[pos];
    return D(a, c) + D(c, b) - D(a, b);
  };
  const bestInsertion = (c: Candidate) => {
    let bestPos = 0;
    let bestDetour = Infinity;
    for (let pos = 0; pos <= tour.length; pos++) {
      const dt = detourAt(c, pos);
      if (dt < bestDetour) {
        bestDetour = dt;
        bestPos = pos;
      }
    }
    return { pos: bestPos, detour: bestDetour };
  };
  const feasible = (c: Candidate, detour: number) => {
    const newDist = curDist + detour;
    const newMin = (newDist / speed) * 60 + curStopMin + c.idealMinutes;
    const newCost = curStopCost + stopCostOf(c) + newDist * v.costPerKm;
    return newMin <= minutesBudget && newCost <= budget;
  };
  const place = (c: Candidate, pos: number, detour: number) => {
    tour.splice(pos, 0, c);
    curDist += detour;
    curStopMin += c.idealMinutes;
    curStopCost += stopCostOf(c);
    covered.add(c.category);
    coveredBands.add(bandOf(c));
    if (isFoodCat(c)) foodUsed = true;
  };

  // De-dup + drop food when the traveller doesn't want a food stop.
  const seen = new Set<string>();
  let pool = input.candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return !(isFoodCat(c) && !input.includeFood);
  });

  // 1) Hand-picked places first — inserted at their cheapest position.
  for (const c of pool.filter((c) => c.pinned)) {
    if (tour.length >= maxStops) break;
    const { pos, detour } = bestInsertion(c);
    if (feasible(c, detour)) place(c, pos, detour);
  }
  const taken = new Set(tour.map((c) => c.id));
  pool = pool.filter((c) => !taken.has(c.id));

  // 2) Greedily insert the best value-per-detour candidate until full.
  while (tour.length < maxStops) {
    let best: { c: Candidate; pos: number; detour: number; ratio: number } | null = null;
    for (const c of pool) {
      if (isFoodCat(c) && foodUsed) continue;
      const { pos, detour } = bestInsertion(c);
      if (!feasible(c, detour)) continue;
      const detourMin = (detour / speed) * 60 + c.idealMinutes;
      const ratio = valueOf(c, covered) / Math.max(5, detourMin);
      if (!best || ratio > best.ratio) best = { c, pos, detour, ratio };
    }
    if (!best) break;
    place(best.c, best.pos, best.detour);
    pool = pool.filter((c) => c.id !== best!.c.id);
  }

  // 3) Optimise the visiting order (remove crossings / backtracking).
  twoOpt(tour, start, D);

  // 4) Materialise per-stop metrics from the optimised order (haversine here;
  // the API refines these with real OSRM road distances afterwards).
  const stops: PlannerStop[] = [];
  let prev: Pt = start;
  let forwardDist = 0;
  let forwardMins = 0;
  for (const c of tour) {
    const dist = D(prev, c);
    const travelMins = (dist / speed) * 60;
    const travelCost = Math.round(dist * v.costPerKm);
    const stopCost = Math.round(stopCostOf(c));
    stops.push({
      ...c,
      arrivalKmFromPrev: dist,
      arrivalMinutesFromPrev: travelMins,
      stopCost,
      travelCost,
    });
    forwardDist += dist;
    forwardMins += travelMins + c.idealMinutes;
    prev = c;
  }

  const totalCost = stops.reduce((s, st) => s + st.stopCost + st.travelCost, 0);
  const perPerson = Math.round(totalCost / people);

  return {
    stops,
    totalDistanceKm: forwardDist,
    totalMinutes: forwardMins,
    totalCost,
    perPersonCost: perPerson,
    unspentBudget: Math.max(0, Math.round(budget - totalCost)),
    unspentMinutes: Math.max(0, Math.round(minutesBudget - forwardMins)),
  };
}
