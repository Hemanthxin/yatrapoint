// Real-time trip budget estimator. Numbers are mid-range Indian assumptions
// in INR; tweak `defaultBudgetParams` to taste.

export type VehicleKind = "bike" | "small_car" | "sedan" | "suv" | "cab";

interface VehicleProfile {
  label: string;
  // Fuel cost per km in INR (incl. fuel + minor wear).
  costPerKm: number;
  // Typical seating excluding driver — used to suggest cost-per-person.
  seats: number;
  emoji: string;
}

// BUG-06: the icons did not match the vehicles they labelled — Sedan showed
// 🚙 (which IS the SUV glyph) and SUV showed 🚐 (a minibus), so the whole
// picker read one vehicle out of step with itself. Each entry now carries the
// glyph for the vehicle it actually names.
export const VEHICLES: Record<VehicleKind, VehicleProfile> = {
  bike: { label: "Bike", costPerKm: 2.5, seats: 1, emoji: "🏍️" }, // motorcycle
  small_car: { label: "Hatchback", costPerKm: 7, seats: 4, emoji: "🚗" }, // automobile
  sedan: { label: "Sedan", costPerKm: 9, seats: 4, emoji: "🚘" }, // oncoming automobile
  suv: { label: "SUV", costPerKm: 12, seats: 6, emoji: "🚙" }, // sport utility vehicle
  cab: { label: "Taxi (Ola/Uber)", costPerKm: 18, seats: 4, emoji: "🚕" }, // taxi
};

export interface BudgetInput {
  distanceKm: number; // one-way
  vehicle: VehicleKind;
  people: number;
  entryFeePerPerson: number;
  foodPerPerson: number; // typical: 350
  parkingFee?: number;
  miscPerPerson?: number; // souvenirs, tea stops, etc.
}

export interface BudgetBreakdown {
  fuelTotal: number;
  entryTotal: number;
  foodTotal: number;
  parking: number;
  miscTotal: number;
  total: number;
  perPerson: number;
  roundTripKm: number;
}

export function calcBudget(input: BudgetInput): BudgetBreakdown {
  const v = VEHICLES[input.vehicle];
  const roundTripKm = input.distanceKm * 2;
  const fuelTotal = Math.round(roundTripKm * v.costPerKm);
  const entryTotal = input.entryFeePerPerson * input.people;
  const foodTotal = (input.foodPerPerson || 0) * input.people;
  const parking = input.parkingFee ?? 0;
  const miscTotal = (input.miscPerPerson ?? 0) * input.people;
  const total = fuelTotal + entryTotal + foodTotal + parking + miscTotal;
  const perPerson = Math.round(total / Math.max(1, input.people));
  return {
    fuelTotal,
    entryTotal,
    foodTotal,
    parking,
    miscTotal,
    total,
    perPerson,
    roundTripKm,
  };
}

export const defaultBudgetParams = {
  vehicle: "small_car" as VehicleKind,
  people: 1,
  foodPerPerson: 350,
  miscPerPerson: 100,
  parkingFee: 50,
};

export interface LongTripBudgetBreakdown {
  fuelTotal: number;
  stayTotal: number;
  foodTotal: number;
  miscTotal: number;
  total: number;
  perPerson: number;
}

// Estimate for a multi-day curated road trip (distinct from calcBudget, which
// is for a single round-trip day out). `distanceKm` is one-way from the base
// city; when unknown we fall back to a flat per-day travel estimate instead
// of fabricating a distance.
export function estimateLongTripBudget(input: {
  days: number;
  distanceKm: number | null;
  vehicle: VehicleKind;
  people: number;
}): LongTripBudgetBreakdown {
  const v = VEHICLES[input.vehicle];
  const fuelTotal = input.distanceKm
    ? Math.round(input.distanceKm * 2 * v.costPerKm)
    : Math.round(input.days * 120 * v.costPerKm); // ~120 km/day of local travel as a fallback
  const nights = Math.max(0, input.days - 1);
  const stayTotal = nights * 2200 * Math.ceil(input.people / 2); // ~₹2,200/night per room, mid-range, 2/room
  const foodTotal = input.days * input.people * 600; // full board estimate
  const miscTotal = input.days * input.people * 250; // entry fees, local transport, incidentals
  const total = fuelTotal + stayTotal + foodTotal + miscTotal;
  return {
    fuelTotal,
    stayTotal,
    foodTotal,
    miscTotal,
    total,
    perPerson: Math.round(total / Math.max(1, input.people)),
  };
}
