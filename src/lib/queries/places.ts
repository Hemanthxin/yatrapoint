import { and, isNull, ne, or, like, sql, type SQL } from "drizzle-orm";
import { places, type Place } from "@/lib/db/schema";
import type { Destination, NearbyDestination, CityPlace } from "@/lib/db/schema";
import { searchVariants } from "@/lib/place-aliases";

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

// --- search ----------------------------------------------------------------

export interface PlaceSearchResult {
  place: Place;
  // 0-100. Exposed so a caller can group by strength rather than just order.
  score: number;
}

// Ranked search across the whole catalogue.
//
// Two things were wrong with matching on `%q%` and ordering by popularity.
//
// It MISSED places. A search for "Mysore" could not see Chamundi Hills,
// Brindavan Gardens, St Philomena's Church, Karanji Lake or Jaganmohan Palace,
// because the catalogue spells that district "Mysuru". Queries are expanded
// through the alias table first, so either spelling finds all of them.
//
// It RANKED BY THE WRONG THING. With no relevance at all, whichever row was
// most popular came first — so Srirangapatna Fort (Mandya) and a dam in
// Chitradurga outranked Mysore Palace on a search for "Mysore", purely because
// their descriptions happen to mention it. A name match now always beats a
// location match, which always beats a passing mention in the prose.
export async function searchPlaces(
  db: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: (q: SQL) => Promise<any>;
  },
  query: string,
  opts: { limit?: number; kind?: PlaceKindName } = {}
): Promise<PlaceSearchResult[]> {
  const limit = opts.limit ?? 40;
  const variants = searchVariants(query);
  if (variants.length === 0) return [];

  // Name and location score SEPARATELY and add up, rather than one exclusive
  // CASE picking a single reason.
  //
  // Under a single CASE, a name match always beat a location match, so
  // searching "Mysore" put "Mysore Road Eidgha" — a road in Bengaluru — above
  // Chamundi Hills and Brindavan Gardens, which are actually in Mysuru. Adding
  // the two means a place that is BOTH named for the query and located in it
  // comes first, then everything else named for it, then everything else in it.
  // The prose match stays tiny, so a passing mention can never outrank either.
  // Each dimension takes its OWN best across the spellings, and only then are
  // they added. Maxing the combined score per-spelling instead would lose the
  // commonest case outright: "Mysore Palace" is named in one spelling and
  // located in the other, so a per-spelling max sees a name hit OR a location
  // hit and never both — which pushed the Palace below a road in Bengaluru.
  const nameScore = (v: string) => sql`CASE
    WHEN lower(${places.name}) = ${v} THEN 100
    WHEN lower(${places.name}) LIKE ${`${v}%`} THEN 70
    WHEN lower(${places.name}) LIKE ${`%${v}%`} THEN 50
    ELSE 0 END`;
  const locationScore = (v: string) => sql`CASE
    WHEN lower(coalesce(${places.district}, '')) LIKE ${`%${v}%`}
      OR lower(coalesce(${places.city}, '')) LIKE ${`%${v}%`}
      OR lower(coalesce(${places.area}, '')) LIKE ${`%${v}%`}
      OR lower(coalesce(${places.baseCity}, '')) LIKE ${`%${v}%`} THEN 40
    WHEN lower(coalesce(${places.state}, '')) LIKE ${`%${v}%`} THEN 15
    ELSE 0 END`;
  const proseScore = (v: string) => sql`CASE
    WHEN lower(${places.shortDescription}) LIKE ${`%${v}%`} THEN 8
    ELSE 0 END`;

  // GREATEST needs at least two arguments; a single variant is passed twice.
  const best = (make: (v: string) => SQL): SQL => {
    const parts = variants.length === 1 ? [variants[0], variants[0]] : variants;
    return sql`GREATEST(${sql.join(parts.map(make), sql`, `)})`;
  };

  const relevance = sql`((${best(nameScore)}) + (${best(locationScore)}) + (${best(proseScore)}))`;

  const rows = await db.execute(sql`
    SELECT *, ${relevance} AS __score
    FROM ${places}
    WHERE (${relevance}) > 0
      AND (${places.googleBusinessStatus} IS NULL
           OR ${places.googleBusinessStatus} <> 'CLOSED_PERMANENTLY')
      AND ${places.isHidden} = false
      ${opts.kind ? sql`AND ${hasKind(opts.kind)}` : sql``}
    ORDER BY __score DESC, ${places.popularity} DESC, ${places.name} ASC
    LIMIT ${limit}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = ((rows as any).rows ?? rows) as Record<string, unknown>[];
  return list.map((r) => ({ place: rowToPlace(r), score: Number(r.__score ?? 0) }));
}

// A raw SQL row (snake_case) back into the Place shape drizzle would return.
function rowToPlace(r: Record<string, unknown>): Place {
  const g = <T,>(k: string) => r[k] as T;
  return {
    id: g("id"), slug: g("slug"), legacySlugs: g("legacy_slugs"), name: g("name"),
    kinds: g("kinds"), category: g("category"), description: g("description"),
    shortDescription: g("short_description"), imageUrl: g("image_url"),
    latitude: g("latitude"), longitude: g("longitude"), popularity: Number(g("popularity")),
    bookingUrl: g("booking_url"), entryFeePerPerson: Number(g("entry_fee_per_person")),
    isHidden: Boolean(g("is_hidden")), state: g("state"), district: g("district"),
    placeType: g("place_type"), openingTimings: g("opening_timings"),
    entryFeesForeigner: g("entry_fees_foreigner"), entryFeesChild: g("entry_fees_child"),
    ticketOptions: g("ticket_options"), visitorGuidelines: g("visitor_guidelines"),
    budgetPerDay: g("budget_per_day"), recommendedDays: g("recommended_days"),
    bestMonths: g("best_months"), addedByEmail: g("added_by_email"),
    addedByName: g("added_by_name"), baseCity: g("base_city"), distanceKm: g("distance_km"),
    drivingMinutes: g("driving_minutes"), idealHoursAtPlace: g("ideal_hours_at_place"),
    bestStartTime: g("best_start_time"), highlights: g("highlights"), city: g("city"),
    cityKind: g("city_kind"), area: g("area"), avgCostForTwo: g("avg_cost_for_two"),
    idealMinutesAtPlace: g("ideal_minutes_at_place"), openTime: g("open_time"),
    closeTime: g("close_time"), openDays: g("open_days"), tags: g("tags"),
    googlePlaceId: g("google_place_id"), googleRating: g("google_rating"),
    googleRatingCount: g("google_rating_count"), googleWeeklyHours: g("google_weekly_hours"),
    googleBusinessStatus: g("google_business_status"), googleSyncedAt: g("google_synced_at"),
    createdAt: g("created_at"),
  } as Place;
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
