// Pure greedy multi-stop selection. Takes candidates + constraints, returns
// a list of stops that fit. The caller then runs OSRM /trip on the picks to
// get an optimised order + real driving distance.

import type { LatLng } from "./geo";
import { haversineKm } from "./geo";
import type { OverpassCategory, OverpassPlace } from "./overpass";
import { VEHICLES, type VehicleKind } from "./budget";

// Per-category typical Indian entry fee (₹/person), visit duration and, for
// eateries, a per-person spend. Calibrated to real 2024 averages so plan totals
// land close to what a trip actually costs (temples/parks free or nominal;
// ASI monuments/museums ₹25–50; theme parks ₹700–900).
export const CATEGORY_DEFAULTS: Record<
  OverpassCategory,
  { entryFee: number; idealMinutes: number; foodCostPerPerson?: number }
> = {
  restaurant: { entryFee: 0, idealMinutes: 60, foodCostPerPerson: 400 },
  cafe: { entryFee: 0, idealMinutes: 45, foodCostPerPerson: 250 },
  fast_food: { entryFee: 0, idealMinutes: 30, foodCostPerPerson: 220 },
  nightlife: { entryFee: 0, idealMinutes: 120, foodCostPerPerson: 1000 },
  mall: { entryFee: 0, idealMinutes: 90 },
  marketplace: { entryFee: 0, idealMinutes: 45 },
  temple: { entryFee: 0, idealMinutes: 40 },
  church: { entryFee: 0, idealMinutes: 30 },
  mosque: { entryFee: 0, idealMinutes: 30 },
  gurudwara: { entryFee: 0, idealMinutes: 30 },
  place_of_worship: { entryFee: 0, idealMinutes: 30 },
  park: { entryFee: 20, idealMinutes: 60 },
  garden: { entryFee: 30, idealMinutes: 60 },
  museum: { entryFee: 50, idealMinutes: 90 },
  viewpoint: { entryFee: 20, idealMinutes: 45 },
  monument: { entryFee: 40, idealMinutes: 50 },
  fort: { entryFee: 40, idealMinutes: 70 },
  lake: { entryFee: 10, idealMinutes: 45 },
  tourist_attraction: { entryFee: 50, idealMinutes: 60 },
  cinema: { entryFee: 200, idealMinutes: 180 },
  theatre: { entryFee: 300, idealMinutes: 150 },
  zoo: { entryFee: 100, idealMinutes: 120 },
  amusement: { entryFee: 800, idealMinutes: 240 },
  station: { entryFee: 0, idealMinutes: 15 },
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
    // Use the real OSM fee when tagged, otherwise a realistic category estimate
    // so the plan total reflects what the trip actually costs (entryFeeKnown
    // stays false so the UI can show it as an estimate).
    entryFee: fee.known ? fee.amount : def.entryFee,
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
  // Hard cap on the TOTAL round-trip distance (km). The whole plan won't exceed
  // this, so a 25 km pick yields a ~25 km trip, 50 → ~50, 100 → ~100 — instead
  // of the route zig-zagging out to far more than the chosen distance.
  maxTripKm?: number;
  // Effective travel cost per km (INR). Overrides the vehicle default so the
  // planner can cost bus/train/flight/fuel with real Karnataka rates. For public
  // transport this already includes the number of people.
  costPerKm?: number;
  // Fixed costs the caller will ADD to the trip total after planning but that
  // the planner itself doesn't pick (the day's meals baseline, a flight base
  // fare, etc.). Reserved up-front so the FINAL total genuinely stays within
  // `totalBudget` — otherwise a low budget (e.g. ₹200) picks stops that fit,
  // then these baselines push the shown total far over what the traveller set.
  reservedCost?: number;
  // Minimum distance (km) the traveller asked for. > 0 signals an intentional
  // FAR / outstation trip → spread across distance bands + seed a far anchor.
  // For a local trip (0) we just pick the nearest N, so the requested number of
  // places actually gets filled instead of a far anchor eating the budget.
  minDistanceKm?: number;
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
  const costPerKm = input.costPerKm ?? v.costPerKm;
  const people = Math.max(1, input.people);
  const pinnedCount = input.candidates.filter((c) => c.pinned).length;
  // Hand-picked places are a hard requirement, not a suggestion — never let the
  // stop-count cap truncate the traveller's own explicit selection.
  const maxStops = Math.max(input.maxStops ?? 6, pinnedCount);
  const start: Pt = input.start;

  // 15% buffer of time for traffic + breaks.
  const minutesBudget = input.hoursAvailable * 60 * 0.85;
  // Money the planner may spend on stops + travel = the total budget MINUS the
  // fixed costs the caller adds afterwards (meals baseline, flight base). If the
  // budget can't even cover those basics, `spendable` goes negative and no stop
  // is feasible → an honest "budget too low" result instead of an over-budget plan.
  const reserved = Math.max(0, input.reservedCost ?? 0);
  const budget = input.totalBudget;
  const spendable = budget - reserved;

  // Total-distance cap. The planner measures distance as straight-line
  // (haversine); real roads run ~1.25× longer, so we divide the chosen km by
  // that factor here — this keeps the FINAL routed (OSRM) round-trip close to
  // the distance the traveller actually picked.
  const ROAD_FACTOR = 1.25;
  const distCap =
    input.maxTripKm && input.maxTripKm > 0 ? input.maxTripKm / ROAD_FACTOR : Infinity;

  const D = (a: Pt, b: Pt) => haversineKm(a, b);
  const stopCostOf = (c: Candidate) =>
    c.entryFee * people + (isFoodCat(c) ? (c.foodCostPerPerson ?? 0) * people : 0);

  // Only spread across distance bands / seed a far anchor for an intentional FAR
  // trip (a chosen minimum distance). For a local trip we pick the nearest N so
  // the requested number of places gets filled — no far detours eating budget.
  const wantFar = (input.minDistanceKm ?? 0) > 0;

  // Distance band of a place within the chosen reach: 0 = near, 1 = mid,
  // 2 = far. Used to spread the trip across the whole radius (far trips only).
  const reachKm = wantFar && input.reachKm && input.reachKm > 0 ? input.reachKm : 0;
  const bandOf = (c: Candidate) =>
    reachKm ? Math.min(2, Math.floor(haversineKm(start, { lat: c.lat, lng: c.lng }) / (reachKm / 3))) : 0;
  const coveredBands = new Set<number>();

  // Worth of a place: base + popularity, a big bonus for a not-yet-covered
  // category (keeps the trip diverse), a bonus for reaching a not-yet-covered
  // distance band (far trips only), and a decisive boost for hand-picked places.
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
    // Never let the total round-trip distance exceed the chosen distance.
    if (newDist > distCap) return false;
    const newMin = (newDist / speed) * 60 + curStopMin + c.idealMinutes;
    // Estimate travel cost against the real road distance (~1.25× haversine) so
    // the planner's budget check matches the OSRM-routed total the API reports.
    const newCost = curStopCost + stopCostOf(c) + newDist * costPerKm * ROAD_FACTOR;
    return newMin <= minutesBudget && newCost <= spendable;
  };
  // Same as `feasible` but WITHOUT the distance-cap check — money and time are
  // real limits, but distCap is just a heuristic ("don't balloon past ~2× the
  // chosen distance") that shouldn't leave the traveller's own stop count and
  // budget unmet when there's genuinely spare money/time to go a bit further.
  // Only used as a fallback (see step 2b) once the capped fill stalls short.
  const feasibleIgnoringDistance = (c: Candidate, detour: number) => {
    const newDist = curDist + detour;
    const newMin = (newDist / speed) * 60 + curStopMin + c.idealMinutes;
    const newCost = curStopCost + stopCostOf(c) + newDist * costPerKm * ROAD_FACTOR;
    return newMin <= minutesBudget && newCost <= spendable;
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

  // Per-candidate jitter (fixed for this one planning run, fresh every call) —
  // lets "Regenerate" turn up a different, still-good selection of places
  // instead of the greedy scorer picking the exact same winner every time.
  // Shuffling the pool too means ties in the ratio below resolve differently
  // across runs, not just the score itself.
  const jitter = new Map<string, number>();
  for (const c of pool) jitter.set(c.id, 0.8 + Math.random() * 0.4);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 1) Hand-picked places first — inserted at their cheapest position. These
  // are placed UNCONDITIONALLY: the traveller explicitly chose them, so the
  // budget/time/distance caps below only ever govern how many EXTRA
  // auto-discovered stops get added on top, never whether a hand-picked place
  // makes it in. (Money/time still show honestly over-budget if 5 far-apart
  // picks genuinely can't fit — but they're never silently dropped.)
  for (const c of pool.filter((c) => c.pinned)) {
    const { pos, detour } = bestInsertion(c);
    place(c, pos, detour);
  }

  const taken = new Set(tour.map((c) => c.id));
  pool = pool.filter((c) => !taken.has(c.id));

  // 1b) Far anchor. The greedy "value per detour" scorer below always favours
  // nearby places (a distant place's huge detour sinks its ratio), so on a wide
  // reach the trip would otherwise hug the start — exactly the "I picked 200 km
  // but it only covers 20-30 km" complaint. When the traveller asked for a wide
  // radius, first seed the loop with the FARTHEST high-value place that still
  // fits time + budget; the greedy fill then strings places along the corridor
  // out to it, so the trip genuinely spans the chosen distance.
  if (wantFar && reachKm > 40 && tour.length < maxStops) {
    const minKm = input.minDistanceKm ?? 0;
    // 200 km+ "around me" trips already work well — keep their exact behaviour
    // untouched below. Smaller distance BANDS (25-50 / 50-100 / 100-200 km)
    // have a large minDistanceKm relative to reachKm, so measuring "far enough
    // to be a real anchor" from zero (reachKm * 0.55) is nearly always already
    // true for every candidate in the band — the search then always grabs the
    // single most extreme point near the outer edge, whose own round trip can
    // swallow almost the entire distance/time/money budget on its own, leaving
    // nothing for the other stops the traveller asked for ("picked 5 places,
    // only 1 shows up, budget barely used"). Below 200 km, measure the "outer
    // half" from the band's OWN inner edge (minKm) instead of from zero, and
    // cap how much of the total budget the anchor alone may spend so real room
    // is reserved for the rest of `maxStops`.
    const legacyBand = minKm >= 200;
    const outer = legacyBand ? reachKm * 0.55 : minKm + (reachKm - minKm) * 0.55;
    const anchorShare = legacyBand ? 1 : Math.min(1, 1.6 / Math.max(1, maxStops));
    const anchorMoneyCap = spendable * anchorShare;
    const anchorMinutesCap = minutesBudget * anchorShare;
    let anchor: { c: Candidate; pos: number; detour: number; dist: number } | null = null;
    for (const c of pool) {
      if (isFoodCat(c) && (foodUsed || !input.includeFood)) continue;
      const dStart = haversineKm(start, { lat: c.lat, lng: c.lng });
      if (dStart < outer) continue;
      const { pos, detour } = bestInsertion(c);
      if (!feasible(c, detour)) continue;
      if (!legacyBand) {
        const projMoney = curStopCost + stopCostOf(c) + (curDist + detour) * costPerKm * ROAD_FACTOR;
        const projMinutes = ((curDist + detour) / speed) * 60 + curStopMin + c.idealMinutes;
        if (projMoney > anchorMoneyCap || projMinutes > anchorMinutesCap) continue;
      }
      // Prefer the farthest reach; break ties by popularity.
      const better =
        !anchor ||
        dStart > anchor.dist + 1 ||
        (Math.abs(dStart - anchor.dist) <= 1 &&
          (c.popularity ?? 50) > (anchor.c.popularity ?? 50));
      if (better) anchor = { c, pos, detour, dist: dStart };
    }
    if (anchor) {
      place(anchor.c, anchor.pos, anchor.detour);
      pool = pool.filter((c) => c.id !== anchor!.c.id);
    }
  }

  // 1c) Category coverage — guarantee AT LEAST ONE stop of every place type the
  // traveller selected (that actually has a candidate here), before the greedy
  // fill. Without this the greedy could spend every slot on one popular type and
  // leave a chosen type with zero places. We add the best-value feasible
  // candidate per still-uncovered category, cheapest categories first so we fit
  // the most types within the budget/time/stop limits.
  const categoriesPresent = [...new Set(pool.map((c) => c.category))];
  for (const cat of categoriesPresent) {
    if (tour.length >= maxStops) break;
    if (covered.has(cat)) continue;
    let pick: { c: Candidate; pos: number; detour: number; ratio: number } | null = null;
    for (const c of pool) {
      if (c.category !== cat) continue;
      if (isFoodCat(c) && (foodUsed || !input.includeFood)) continue;
      const { pos, detour } = bestInsertion(c);
      if (!feasible(c, detour)) continue;
      const ratio =
        (valueOf(c, covered) * (jitter.get(c.id) ?? 1)) /
        Math.max(5, (detour / speed) * 60 + c.idealMinutes);
      if (!pick || ratio > pick.ratio) pick = { c, pos, detour, ratio };
    }
    if (pick) {
      place(pick.c, pick.pos, pick.detour);
      pool = pool.filter((c) => c.id !== pick!.c.id);
    }
  }

  // 2) Greedily insert the best value-per-detour candidate until full.
  while (tour.length < maxStops) {
    let best: { c: Candidate; pos: number; detour: number; ratio: number } | null = null;
    for (const c of pool) {
      if (isFoodCat(c) && foodUsed) continue;
      const { pos, detour } = bestInsertion(c);
      if (!feasible(c, detour)) continue;
      const detourMin = (detour / speed) * 60 + c.idealMinutes;
      const ratio = (valueOf(c, covered) * (jitter.get(c.id) ?? 1)) / Math.max(5, detourMin);
      if (!best || ratio > best.ratio) best = { c, pos, detour, ratio };
    }
    if (!best) break;
    place(best.c, best.pos, best.detour);
    pool = pool.filter((c) => c.id !== best!.c.id);
  }

  // 2b) Relaxed fill — the distance-capped loop above stalled short of the
  // requested stop count. If there's real budget/time left over, use it
  // rather than leaving the trip both under-filled AND under-spent; the
  // traveller asked for N stops, and "stay within ~2x the chosen distance"
  // is a heuristic, not a hard promise, the way the money/time limits are.
  while (tour.length < maxStops) {
    let best: { c: Candidate; pos: number; detour: number; ratio: number } | null = null;
    for (const c of pool) {
      if (isFoodCat(c) && foodUsed) continue;
      const { pos, detour } = bestInsertion(c);
      if (!feasibleIgnoringDistance(c, detour)) continue;
      const detourMin = (detour / speed) * 60 + c.idealMinutes;
      const ratio = (valueOf(c, covered) * (jitter.get(c.id) ?? 1)) / Math.max(5, detourMin);
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
    const travelCost = Math.round(dist * costPerKm);
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
    unspentBudget: Math.max(0, Math.round(budget - reserved - totalCost)),
    unspentMinutes: Math.max(0, Math.round(minutesBudget - forwardMins)),
  };
}
