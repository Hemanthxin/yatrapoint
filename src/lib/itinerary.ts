// Day-bucketing + cost breakdown for a FIXED, already-decided list of stops —
// used by the Group Trip Planner's itinerary generation. This solves a
// different problem than the solo Budget Planner's `planMultiStop`
// (src/lib/multi-stop.ts): that algorithm decides WHICH places to include
// from a large candidate pool; here the admin has already chosen the exact
// places, so all that's left is ordering them (via fetchTrip's real OSRM
// TSP solve) and splitting the ordered list across the trip's days.

export interface ItineraryStop {
  placeId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  entryFeePerPerson: number;
  idealMinutes: number;
  lat: number;
  lng: number;
  // Real road distance/time from the PREVIOUS stop (or the start, for the
  // first stop of each day), from OSRM via fetchTrip.
  arrivalKmFromPrev: number;
  arrivalMinutesFromPrev: number;
}

export interface ItineraryDay {
  day: number;
  stops: ItineraryStop[];
}

export interface ItineraryCostBreakdown {
  fuelTotal: number;
  entryFeesTotal: number;
  foodTotal: number;
  total: number;
  perPersonCost: number;
}

export interface GeneratedItinerary {
  days: ItineraryDay[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  geometry: [number, number][] | null;
  cost: ItineraryCostBreakdown;
  generatedAt: string; // ISO
}

// Same meals-per-person-per-day estimate the solo planner reserves
// (src/app/api/multi-stop/plan/route.ts's MEALS_PER_PERSON_PER_DAY).
export const GROUP_FOOD_PER_PERSON_PER_DAY = 350;

// Greedily fills each day up to `minutesPerDay` (dwell time + travel time),
// spilling extra stops into the next day. Preserves the given order (the
// real routed visit order), so a day never jumps around geographically.
export function bucketStopsByDay(
  stops: ItineraryStop[],
  days: number,
  minutesPerDay = 8 * 60
): ItineraryDay[] {
  const buckets: ItineraryDay[] = Array.from({ length: Math.max(1, days) }, (_, i) => ({ day: i + 1, stops: [] }));
  let dayIdx = 0;
  let minutesUsed = 0;

  for (const stop of stops) {
    const stopMinutes = stop.idealMinutes + stop.arrivalMinutesFromPrev;
    const isFirstOfDay = buckets[dayIdx].stops.length === 0;
    // Always place at least one stop per day even if it alone exceeds the
    // budget (a single far/long stop shouldn't vanish from the plan), but
    // otherwise roll over to the next day once the current one is full.
    if (!isFirstOfDay && minutesUsed + stopMinutes > minutesPerDay && dayIdx < buckets.length - 1) {
      dayIdx += 1;
      minutesUsed = 0;
    }
    buckets[dayIdx].stops.push(stop);
    minutesUsed += stopMinutes;
  }

  return buckets.filter((b) => b.stops.length > 0);
}
