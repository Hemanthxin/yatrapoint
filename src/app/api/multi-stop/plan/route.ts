import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cityPlaces } from "@/lib/db/schema";
import { fetchOverpassPlaces, type OverpassCategory } from "@/lib/overpass";
import { fetchRoute } from "@/lib/routing";
import {
  CATEGORY_DEFAULTS,
  candidateFromOverpass,
  planMultiStop,
  type Candidate,
} from "@/lib/multi-stop";
import { VEHICLES, type VehicleKind } from "@/lib/budget";
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
];

const VEHICLE_KINDS = Object.keys(VEHICLES) as VehicleKind[];

const bodySchema = z.object({
  start: z.object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  }),
  totalBudget: z.number().int().min(200).max(2_000_000),
  hours: z.number().min(1).max(18),
  people: z.number().int().min(1).max(20),
  vehicle: z.enum(VEHICLE_KINDS as [VehicleKind, ...VehicleKind[]]),
  // User-facing OSM categories (we accept any of ALL_OVERPASS).
  categories: z.array(z.string()).min(1),
  includeFood: z.boolean().default(true),
  maxStops: z.number().int().min(2).max(10).default(6),
  searchRadiusKm: z.number().min(1).max(80).default(25),
});

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
  if (wantedCats.length === 0) {
    return NextResponse.json(
      { error: "No valid categories specified" },
      { status: 400 }
    );
  }

  // De-dup key — round to ~110 m so the same place from seed + Overpass merges.
  const coordKey = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;

  // 1) Curated seed places that match the wanted categories.
  const seedMatches = await db
    .select()
    .from(cityPlaces)
    .where(
      inArray(
        cityPlaces.kind,
        Object.entries(SEED_KIND_TO_OVERPASS)
          .filter(([, op]) => wantedCats.includes(op))
          .map(([k]) => k)
      )
    );

  const seedCandidates: Candidate[] = seedMatches
    .filter((s) => {
      const op = SEED_KIND_TO_OVERPASS[s.kind];
      return op && wantedCats.includes(op);
    })
    .map((s) => {
      const op = SEED_KIND_TO_OVERPASS[s.kind] ?? "tourist_attraction";
      return {
        id: `seed:${s.id}`,
        name: s.name,
        category: op,
        lat: Number(s.latitude),
        lng: Number(s.longitude),
        entryFee: s.entryFeePerPerson,
        idealMinutes: s.idealMinutesAtPlace,
        foodCostPerPerson:
          s.avgCostForTwo != null ? Math.round(s.avgCostForTwo / 2) : undefined,
        popularity: s.popularity,
        meta: { citySeedSlug: s.slug },
      };
    });

  // 2) Live Overpass candidates, merged + de-duped. Auto-widen the radius when
  // the area is sparse so we can reliably reach the requested number of places.
  const finalCandidates: Candidate[] = [...seedCandidates];
  const usedKeys = new Set(seedCandidates.map((s) => coordKey(s.lat, s.lng)));
  let overpassCount = 0;
  let overpassError: string | null = null;

  const addOverpass = async (radiusKm: number) => {
    const places = await fetchOverpassPlaces({
      centre: parsed.data.start,
      categories: wantedCats,
      radius: radiusKm * 1000,
      limit: 250,
      cap: 250,
    });
    overpassCount += places.length;
    for (const op of places) {
      const c = candidateFromOverpass(op);
      const k = coordKey(c.lat, c.lng);
      if (!usedKeys.has(k)) {
        usedKeys.add(k);
        finalCandidates.push(c);
      }
    }
  };

  let radiusKm = parsed.data.searchRadiusKm;
  try {
    await addOverpass(radiusKm);
  } catch (err) {
    overpassError = err instanceof Error ? err.message : "Overpass failed";
  }

  // Widen up to twice (capped at 60 km) until we have a healthy candidate pool.
  const targetPool = Math.max(12, parsed.data.maxStops * 3);
  let widen = 0;
  while (finalCandidates.length < targetPool && radiusKm < 60 && widen < 2 && !overpassError) {
    radiusKm = Math.min(60, radiusKm * 2);
    widen += 1;
    try {
      await addOverpass(radiusKm);
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

  // 3) Greedy pick.
  const plan = planMultiStop({
    start: parsed.data.start,
    totalBudget: parsed.data.totalBudget,
    hoursAvailable: parsed.data.hours,
    people: parsed.data.people,
    vehicle: parsed.data.vehicle,
    includeFood: parsed.data.includeFood,
    maxStops: parsed.data.maxStops,
    candidates: finalCandidates,
  });

  if (plan.stops.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Budget or time is too small to reach any place from your location. Try increasing both.",
      },
      { status: 422 }
    );
  }

  // 4) Build the real road route through the stops IN NEAREST-FIRST ORDER.
  // The greedy picker already orders stops nearest-first from the start (stop 1
  // is closest to you, stop 2 closest to stop 1, and so on). We deliberately do
  // NOT run OSRM's TSP /trip here — that reorders into a shortest *loop*, which
  // makes the numbering look wrong (a far stop can come before a near one). We
  // route through the stops in order and return to the start, then overwrite the
  // straight-line (haversine) leg metrics with OSRM's REAL road distances/times.
  const vehicleProfile = VEHICLES[parsed.data.vehicle];
  const routeWaypoints = [
    parsed.data.start,
    ...plan.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
    parsed.data.start, // return home — closes the loop for a proper round trip
  ];
  const route = await fetchRoute(routeWaypoints);

  let orderedStops = plan.stops;
  let roadFuelTotal: number | null = null;
  if (route && route.legs.length >= plan.stops.length) {
    // legs[k] is the drive arriving at stop k: legs[0] = start → stop 1,
    // legs[1] = stop 1 → stop 2, … The trailing leg is the return to start
    // (counted in the total distance/fuel, not shown per-stop).
    orderedStops = plan.stops.map((s, k) => {
      const leg = route.legs[k];
      if (!leg) return s;
      return {
        ...s,
        arrivalKmFromPrev: leg.distanceKm,
        arrivalMinutesFromPrev: leg.durationMinutes,
        travelCost: Math.round(leg.distanceKm * vehicleProfile.costPerKm),
      };
    });
    roadFuelTotal = Math.round(route.distanceKm * vehicleProfile.costPerKm);
  }

  // Recompute totals from real road distances when OSRM data is available so
  // the headline cost matches the per-stop legs and Google Maps.
  const stopCostTotal = orderedStops.reduce((sum, s) => sum + s.stopCost, 0);
  const realTotalCost =
    roadFuelTotal != null ? roadFuelTotal + stopCostTotal : plan.totalCost;
  const realPerPerson = Math.round(realTotalCost / Math.max(1, parsed.data.people));

  return NextResponse.json({
    ok: true,
    candidatesConsidered: finalCandidates.length,
    overpassPlaces: overpassCount,
    seedPlaces: seedCandidates.length,
    overpassError,
    stops: orderedStops,
    totals: {
      distanceKm: route?.distanceKm ?? plan.totalDistanceKm * 2, // assume return
      durationMinutes: route?.durationMinutes ?? plan.totalMinutes,
      cost: realTotalCost,
      perPersonCost: realPerPerson,
      unspentBudget: Math.max(0, parsed.data.totalBudget - realTotalCost),
      unspentMinutes: plan.unspentMinutes,
    },
    geometry: route?.geometry ?? null,
    legs: route?.legs ?? null,
  });
}
