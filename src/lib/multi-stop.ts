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

export function planMultiStop(input: PlannerInput): PlannerResult {
  const speed = input.avgSpeedKmh ?? 28; // urban driving baseline
  const v = VEHICLES[input.vehicle];

  let remainingBudget = input.totalBudget;
  let remainingMinutes = input.hoursAvailable * 60;
  let position: LatLng = input.start;
  const stops: PlannerStop[] = [];
  let totalDist = 0;
  let totalMins = 0;
  const taken = new Set<string>();
  // Which categories we've already included — used to spread the trip across
  // ALL the place types the traveller selected instead of clustering on one.
  const usedCats = new Set<string>();
  let foodTaken = false;

  // Always leave a 15% buffer of time for traffic + breaks.
  const minutesBudget = remainingMinutes * 0.85;
  remainingMinutes = minutesBudget;

  const maxStops = input.maxStops ?? 6;
  // How strongly to prefer a not-yet-covered category (in "km-equivalent").
  const COVERAGE_BONUS_KM = 10;

  while (stops.length < maxStops) {
    const scored = input.candidates
      .filter((c) => !taken.has(c.id))
      .map((c) => {
        const dist = haversineKm(position, { lat: c.lat, lng: c.lng });
        // Popularity boost: a 90-popular place beats a 50 by ~1.6 km.
        const popBonus = ((c.popularity ?? 50) - 50) / 25;
        // Big boost for a category we haven't visited yet → covers all types.
        const coverageBonus = usedCats.has(c.category) ? 0 : COVERAGE_BONUS_KM;
        // Hand-picked places win decisively — they're chosen before any
        // auto-discovered candidate, as long as budget + time still allow.
        const pinnedBonus = c.pinned ? 100_000 : 0;
        const score = dist - popBonus - coverageBonus - pinnedBonus;
        return { c, dist, score };
      })
      .sort((a, b) => a.score - b.score);

    let picked: { c: Candidate; dist: number } | null = null;
    for (const s of scored) {
      const c = s.c;
      // If we already took a food stop and this is food, skip.
      const isFood =
        c.category === "restaurant" ||
        c.category === "cafe" ||
        c.category === "fast_food";
      if (isFood && (!input.includeFood || foodTaken)) continue;

      const travelMins = (s.dist / speed) * 60;
      const totalLegMins = travelMins + c.idealMinutes;
      const travelCost = s.dist * v.costPerKm;
      const stopCost =
        c.entryFee * input.people +
        (isFood ? (c.foodCostPerPerson ?? 0) * input.people : 0);
      const legCost = travelCost + stopCost;

      if (legCost > remainingBudget) continue;
      if (totalLegMins > remainingMinutes) continue;

      picked = { c, dist: s.dist };
      break;
    }

    if (!picked) break;

    const dist = picked.dist;
    const travelMins = (dist / speed) * 60;
    const travelCost = Math.round(dist * v.costPerKm);
    const isFood =
      picked.c.category === "restaurant" ||
      picked.c.category === "cafe" ||
      picked.c.category === "fast_food";
    const stopCost = Math.round(
      picked.c.entryFee * input.people +
        (isFood ? (picked.c.foodCostPerPerson ?? 0) * input.people : 0)
    );

    stops.push({
      ...picked.c,
      arrivalKmFromPrev: dist,
      arrivalMinutesFromPrev: travelMins,
      stopCost,
      travelCost,
    });
    if (isFood) foodTaken = true;
    remainingBudget -= travelCost + stopCost;
    remainingMinutes -= travelMins + picked.c.idealMinutes;
    totalDist += dist;
    totalMins += travelMins + picked.c.idealMinutes;
    position = { lat: picked.c.lat, lng: picked.c.lng };
    taken.add(picked.c.id);
    usedCats.add(picked.c.category);
  }

  const totalCost = stops.reduce((s, st) => s + st.stopCost + st.travelCost, 0);
  const perPerson = Math.round(totalCost / Math.max(1, input.people));

  return {
    stops,
    totalDistanceKm: totalDist,
    totalMinutes: totalMins,
    totalCost,
    perPersonCost: perPerson,
    unspentBudget: Math.max(0, Math.round(remainingBudget)),
    unspentMinutes: Math.max(0, Math.round(remainingMinutes)),
  };
}
