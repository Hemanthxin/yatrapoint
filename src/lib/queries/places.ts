import { and, isNull, ne, or, like, sql, type SQL } from "drizzle-orm";
import { places, type Place } from "@/lib/db/schema";
import type { Destination, NearbyDestination, CityPlace } from "@/lib/db/schema";

// The single place catalogue. Everything that used to read `destinations`,
// `nearby_destinations` or `city_places` reads this instead.
//
// A place belongs to one or more catalogues, recorded in `kinds`. The three
// legacy shapes are still produced by the adapters below, so the pages and
// components that consume them did not have to change when the tables merged.

export const PLACE_KINDS = {
  destination: "destination",
  dayTrip: "day-trip",
  city: "city",
} as const;
export type PlaceKindName = (typeof PLACE_KINDS)[keyof typeof PLACE_KINDS];

// `kinds` is a comma-separated list, so a plain LIKE would match "day-trip"
// inside nothing else but would match "city" inside a hypothetical "citywide".
// Comma-padding both sides makes the test exact.
export function hasKind(kind: PlaceKindName): SQL {
  return sql`(',' || ${places.kinds} || ',') LIKE ${"%," + kind + ",%"}`;
}

export function kindsOf(place: Pick<Place, "kinds">): PlaceKindName[] {
  return place.kinds.split(",").filter(Boolean) as PlaceKindName[];
}

export function isKind(place: Pick<Place, "kinds">, kind: PlaceKindName): boolean {
  return kindsOf(place).includes(kind);
}

// Permanently-closed places never reach a traveller-facing list. Rows never
// synced (null) count as open — most of the catalogue is unsynced, and treating
// unknown as closed would empty every page.
export const notPermanentlyClosed = or(
  isNull(places.googleBusinessStatus),
  ne(places.googleBusinessStatus, "CLOSED_PERMANENTLY")
)!;

// Match a place by its current slug OR any slug it used to be reachable by,
// so every /destinations/x, /one-day-trips/y and /explore-bangalore/z link
// minted before the merge still resolves.
export function slugMatches(slug: string): SQL {
  return or(
    sql`${places.slug} = ${slug}`,
    // legacy_slugs is a JSON array of strings; quoting the needle stops
    // "nandi" from matching "nandi-hills".
    like(places.legacySlugs, `%"${slug}"%`)
  )!;
}

export function visibleWhere(...extra: (SQL | undefined)[]): SQL {
  return and(notPermanentlyClosed, ...extra.filter((x): x is SQL => !!x))!;
}

// --- adapters to the legacy row shapes -------------------------------------
// These let the rest of the app keep its existing types. Each fills the fields
// that catalogue always had; a place that isn't of that kind simply won't be
// returned by the queries that use the adapter.

export function toDestination(p: Place): Destination {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    state: p.state ?? "",
    district: p.district,
    category: p.category,
    placeType: p.placeType,
    description: p.description,
    shortDescription: p.shortDescription,
    imageUrl: p.imageUrl,
    openingTimings: p.openingTimings,
    entryFees: p.entryFeePerPerson,
    entryFeesForeigner: p.entryFeesForeigner,
    entryFeesChild: p.entryFeesChild,
    ticketOptions: p.ticketOptions,
    bookingUrl: p.bookingUrl,
    visitorGuidelines: p.visitorGuidelines,
    budgetPerDay: p.budgetPerDay ?? 0,
    recommendedDays: p.recommendedDays ?? 1,
    bestMonths: p.bestMonths,
    isHidden: p.isHidden,
    popularity: p.popularity,
    latitude: p.latitude,
    longitude: p.longitude,
    addedByEmail: p.addedByEmail,
    addedByName: p.addedByName,
    googlePlaceId: p.googlePlaceId,
    googleRating: p.googleRating,
    googleRatingCount: p.googleRatingCount,
    googleWeeklyHours: p.googleWeeklyHours,
    googleBusinessStatus: p.googleBusinessStatus,
    googleSyncedAt: p.googleSyncedAt,
    createdAt: p.createdAt,
  };
}

export function toNearbyDestination(p: Place): NearbyDestination {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    baseCity: p.baseCity ?? "Bangalore",
    category: p.category,
    description: p.description,
    shortDescription: p.shortDescription,
    imageUrl: p.imageUrl,
    distanceKm: p.distanceKm ?? 0,
    drivingMinutes: p.drivingMinutes ?? 0,
    entryFeePerPerson: p.entryFeePerPerson,
    idealHoursAtPlace: p.idealHoursAtPlace ?? 3,
    bestStartTime: p.bestStartTime,
    highlights: p.highlights,
    latitude: p.latitude ?? "",
    longitude: p.longitude ?? "",
    popularity: p.popularity,
    bookingUrl: p.bookingUrl,
    googlePlaceId: p.googlePlaceId,
    googleRating: p.googleRating,
    googleRatingCount: p.googleRatingCount,
    googleWeeklyHours: p.googleWeeklyHours,
    googleBusinessStatus: p.googleBusinessStatus,
    googleSyncedAt: p.googleSyncedAt,
    createdAt: p.createdAt,
  };
}

export function toCityPlace(p: Place): CityPlace {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    city: p.city ?? "Bengaluru",
    kind: p.cityKind ?? "attraction",
    category: p.category,
    area: p.area,
    description: p.description,
    shortDescription: p.shortDescription,
    imageUrl: p.imageUrl,
    entryFeePerPerson: p.entryFeePerPerson,
    avgCostForTwo: p.avgCostForTwo,
    idealMinutesAtPlace: p.idealMinutesAtPlace ?? 60,
    openTime: p.openTime,
    closeTime: p.closeTime,
    openDays: p.openDays,
    tags: p.tags,
    latitude: p.latitude ?? "",
    longitude: p.longitude ?? "",
    googlePlaceId: p.googlePlaceId,
    googleRating: p.googleRating,
    googleRatingCount: p.googleRatingCount,
    googleWeeklyHours: p.googleWeeklyHours,
    googleBusinessStatus: p.googleBusinessStatus,
    googleSyncedAt: p.googleSyncedAt,
    popularity: p.popularity,
    bookingUrl: p.bookingUrl,
    createdAt: p.createdAt,
  };
}
