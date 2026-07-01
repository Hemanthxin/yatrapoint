// Transport cost model derived from the real Karnataka datasets in Data/.
// Server-only (imports JSON that we don't want in the client bundle).
//
// Rules the product wants:
//  • Fuel prices + BMTC bus fares apply ONLY to Bengaluru trips.
//  • Train / flight use the Karnataka rail / flight fare data (per person).
//  • Car / bike burn fuel (per vehicle, shared by the group).

import busFares from "@/lib/db/data/bus-fares.json";
import trainFares from "@/lib/db/data/train-fares.json";
import flightFares from "@/lib/db/data/flight-fares.json";
import fuelRates from "@/lib/db/data/fuel-rates.json";
import { haversineKm, type LatLng } from "@/lib/geo";
import type { VehicleKind } from "@/lib/budget";

export type TravelMode = "any" | "car" | "bike" | "bus" | "train" | "flight";

// ── Bengaluru gate ──────────────────────────────────────────────────────────
const BENGALURU: LatLng = { lat: 12.9716, lng: 77.5946 };
const BENGALURU_RADIUS_KM = 45;
export function isBengaluru(centre: LatLng): boolean {
  return haversineKm(BENGALURU, centre) <= BENGALURU_RADIUS_KM;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const median = (xs: number[]): number => {
  const a = xs.filter((n) => Number.isFinite(n) && n > 0).sort((p, q) => p - q);
  if (a.length === 0) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// Fuel price per litre for a district (Bengaluru-specific when it's a Bengaluru
// trip, else the Karnataka average from the sheet).
const FUEL_AVG =
  fuelRates.find((f) => /average/i.test(f.district)) ?? { petrol: 111.33, diesel: 99.27 };
export function fuelPrice(inBengaluru: boolean, fuel: "petrol" | "diesel" = "petrol"): number {
  if (inBengaluru) {
    const blr = fuelRates.find((f) => /beng|bang/i.test(f.district));
    if (blr && blr[fuel]) return blr[fuel] as number;
  }
  return (FUEL_AVG[fuel] as number) ?? 111;
}

// Typical mileage (km/l) per vehicle — used with the real fuel price so the
// fuel cost tracks Karnataka pump rates instead of a hard-coded ₹/km.
const MILEAGE: Record<VehicleKind, number> = {
  bike: 45,
  small_car: 16,
  sedan: 14,
  suv: 11,
  cab: 13,
};

// Per-km rates derived once from the datasets.
export const BMTC_PER_KM = median(
  (busFares as { distanceKm: number | null; fare: number | null }[]).map((r) =>
    r.distanceKm && r.fare ? r.fare / r.distanceKm : 0
  )
); // ≈ ₹3–4 /km, per person
export const TRAIN_SLEEPER_PER_KM = median(
  (trainFares as { distanceKm: number | null; sleeper: number | null }[]).map((r) =>
    r.distanceKm && r.sleeper ? r.sleeper / r.distanceKm : 0
  )
); // per person
export const FLIGHT_PER_KM = median(
  (flightFares as { distanceKm: number | null; minFare: number | null }[]).map((r) =>
    r.distanceKm && r.minFare ? r.minFare / r.distanceKm : 0
  )
);
export const FLIGHT_BASE = median(
  (flightFares as { minFare: number | null }[]).map((r) => r.minFare ?? 0)
); // typical minimum ticket, per person

// ── cost per km ─────────────────────────────────────────────────────────────
export interface TravelCost {
  // Total cost of driving/travelling `km` for `people` on this mode.
  cost: number;
  // How the cost was worked out — shown to the traveller.
  label: string;
  // True when cost scales with the number of people (public transport).
  perPerson: boolean;
}

export function travelCostFor(
  mode: TravelMode,
  vehicle: VehicleKind,
  km: number,
  people: number,
  inBengaluru: boolean
): TravelCost {
  switch (mode) {
    case "bus": {
      // BMTC only in Bengaluru; a generic intercity bus rate elsewhere.
      const perKm = inBengaluru && BMTC_PER_KM > 0 ? BMTC_PER_KM : 1.5;
      return {
        cost: Math.round(km * perKm * people),
        label: inBengaluru ? "BMTC bus fare" : "Bus fare (est.)",
        perPerson: true,
      };
    }
    case "train": {
      const perKm = TRAIN_SLEEPER_PER_KM > 0 ? TRAIN_SLEEPER_PER_KM : 1.2;
      return {
        cost: Math.round(km * perKm * people),
        label: "Train fare (sleeper)",
        perPerson: true,
      };
    }
    case "flight": {
      const perKm = FLIGHT_PER_KM > 0 ? FLIGHT_PER_KM : 10;
      // A minimum ticket applies even for short hops.
      const cost = Math.max(FLIGHT_BASE, km * perKm) * people;
      return { cost: Math.round(cost), label: "Flight fare (advance)", perPerson: true };
    }
    case "bike":
    case "car":
    case "any":
    default: {
      const mileage = MILEAGE[vehicle] ?? 16;
      const price = fuelPrice(inBengaluru, "petrol");
      const perKm = price / mileage;
      return {
        cost: Math.round(km * perKm),
        label: inBengaluru ? "Fuel (Bengaluru rate)" : "Fuel",
        perPerson: false,
      };
    }
  }
}

// The effective ₹/km for a mode (used where a scalar rate is convenient, e.g.
// re-costing a swapped stop). For public transport this is per-person.
export function perKmRate(mode: TravelMode, vehicle: VehicleKind, inBengaluru: boolean): { rate: number; perPerson: boolean } {
  const c = travelCostFor(mode, vehicle, 1, 1, inBengaluru);
  const pub = c.perPerson;
  return { rate: c.cost, perPerson: pub };
}

export function isPublicTransport(mode: TravelMode): boolean {
  return mode === "bus" || mode === "train" || mode === "flight";
}
