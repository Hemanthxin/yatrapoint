"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Wallet,
} from "lucide-react";

import type { CityPlace } from "@/lib/db/schema";
import { useLocation } from "@/components/app/LocationContext";
import { sortByUserDistance } from "@/lib/nearby-utils";
import { formatINR } from "@/lib/format";
import { formatKm, formatMinutes } from "@/lib/geo";
import { placeMapUrl } from "@/lib/maps";
import { EmptyState } from "@/components/app/EmptyState";
import { NoDataIllustration } from "@/components/illustrations";

interface OverpassPlaceClient {
  osmId: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  tags: {
    cuisine?: string;
    openingHours?: string;
    website?: string;
    phone?: string;
    addrFull?: string;
  };
}

// User-facing category groups + Overpass categories they query.
const GROUPS = [
  { slug: "all", label: "All", emoji: "🌐", overpass: [] as string[] },
  { slug: "restaurants", label: "Restaurants", emoji: "🍽️", overpass: ["restaurant"] },
  { slug: "cafes", label: "Cafés", emoji: "☕", overpass: ["cafe"] },
  { slug: "nightlife", label: "Pubs & Bars", emoji: "🍻", overpass: ["nightlife"] },
  { slug: "malls", label: "Malls & Markets", emoji: "🛍️", overpass: ["mall", "marketplace"] },
  { slug: "temples", label: "Temples", emoji: "🛕", overpass: ["temple", "place_of_worship"] },
  { slug: "churches", label: "Churches", emoji: "⛪", overpass: ["church"] },
  { slug: "parks", label: "Parks", emoji: "🌳", overpass: ["park", "garden"] },
  { slug: "lakes", label: "Lakes", emoji: "💧", overpass: ["lake"] },
  { slug: "museums", label: "Museums", emoji: "🏛️", overpass: ["museum"] },
  { slug: "heritage", label: "Heritage", emoji: "🏯", overpass: ["monument", "fort", "tourist_attraction"] },
  { slug: "viewpoints", label: "Viewpoints", emoji: "🌄", overpass: ["viewpoint"] },
  { slug: "amusement", label: "Fun & Zoo", emoji: "🎢", overpass: ["amusement", "zoo"] },
];

// Map our seeded `kind` field to a group slug for filtering.
const SEED_KIND_TO_GROUP: Record<string, string> = {
  restaurant: "restaurants",
  attraction: "heritage",
  temple: "temples",
  church: "churches",
  museum: "museums",
  park: "parks",
  lake: "lakes",
  mall: "malls",
  market: "malls",
  nightlife: "nightlife",
  viewpoint: "viewpoints",
};

// Reverse of SEED_KIND_TO_GROUP — which city_places `kind` values a group
// covers, so the API can filter server-side before its distance limit runs.
const GROUP_TO_SEED_KINDS: Record<string, string[]> = {};
for (const [kind, group] of Object.entries(SEED_KIND_TO_GROUP)) {
  (GROUP_TO_SEED_KINDS[group] ??= []).push(kind);
}

const OVERPASS_TO_GROUP: Record<string, string> = {
  restaurant: "restaurants",
  fast_food: "restaurants",
  cafe: "cafes",
  nightlife: "nightlife",
  mall: "malls",
  marketplace: "malls",
  temple: "temples",
  place_of_worship: "temples",
  church: "churches",
  mosque: "churches",
  gurudwara: "churches",
  park: "parks",
  garden: "parks",
  lake: "lakes",
  museum: "museums",
  monument: "heritage",
  fort: "heritage",
  tourist_attraction: "heritage",
  viewpoint: "viewpoints",
  amusement: "amusement",
  zoo: "amusement",
  cinema: "amusement",
  theatre: "amusement",
};

interface ExploreClientProps {
  seed: CityPlace[];
}

export function ExploreClient({ seed }: ExploreClientProps) {
  const { coords, status, isFallback } = useLocation();
  const [group, setGroup] = useState<string>("all");
  const [radiusKm, setRadiusKm] = useState(8);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overpass, setOverpass] = useState<OverpassPlaceClient[]>([]);
  // Curated places WITHIN the chosen radius, pulled from the FULL catalogue by a
  // bounding-box API (not the small popularity slice the page ships for first
  // paint). Populated once we have the user's location.
  const [nearbySeed, setNearbySeed] = useState<CityPlace[] | null>(null);

  // Pull Overpass data whenever group / location / radius changes (except for
  // "all" — too broad an Overpass query; for "all" we use just the seed).
  useEffect(() => {
    if (status === "prompting" || status === "idle") return;
    const target = GROUPS.find((g) => g.slug === group);
    if (!target || target.overpass.length === 0) {
      setOverpass([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      lat: String(coords.lat),
      lng: String(coords.lng),
      radius: String(radiusKm * 1000),
      categories: target.overpass.join(","),
      limit: "80",
    });
    fetch(`/api/overpass/places?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.ok) throw new Error(data.error || "Overpass failed");
        setOverpass(data.places);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setOverpass([]);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [group, radiusKm, coords.lat, coords.lng, status]);

  // Pull the full set of curated places WITHIN the chosen radius (bounding-box
  // API) whenever location, radius or category changes — so "within 8 km"
  // really shows everything within 8 km, not just the popularity slice
  // shipped for paint.
  useEffect(() => {
    if (status === "prompting" || status === "idle") return;
    const ctrl = new AbortController();
    const kinds = GROUP_TO_SEED_KINDS[group];
    const params = new URLSearchParams({
      lat: String(coords.lat),
      lng: String(coords.lng),
      radiusKm: String(radiusKm),
      // Ask the server to filter by category BEFORE its distance limit runs —
      // otherwise a rare category (a few dozen malls citywide) gets crowded
      // out by the nearest cap of a dense one (thousands of restaurants)
      // before the client ever sees it.
      limit: "1200",
      ...(kinds ? { kinds: kinds.join(",") } : {}),
    });
    fetch(`/api/nearby-places?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.places)) setNearbySeed(data.places);
      })
      .catch(() => {
        /* keep the first-paint seed */
      });
    return () => ctrl.abort();
  }, [coords.lat, coords.lng, radiusKm, status, group]);

  // Build a unified list: seed + Overpass, dedup by lat/lng proximity, sort by distance.
  const unified = useMemo(() => {
    // Prefer the within-radius set from the API; fall back to the shipped seed.
    const seedSource = nearbySeed ?? seed;
    const seedFiltered = seedSource.filter((s) => {
      if (group === "all") return true;
      const g = SEED_KIND_TO_GROUP[s.kind];
      return g === group;
    });

    const sorted = sortByUserDistance(seedFiltered, coords).map((s) => ({
      kind: "seed" as const,
      key: `seed:${s.id}`,
      seed: s,
      lat: Number(s.latitude),
      lng: Number(s.longitude),
      userDistanceKm: s.userDistanceKm,
    }));

    const opSorted = sortByUserDistance(
      overpass.map((o) => ({ ...o, latitude: String(o.lat), longitude: String(o.lng) })),
      coords
    ).map((o) => ({
      kind: "osm" as const,
      key: `osm:${o.osmId}`,
      osm: o,
      lat: o.lat,
      lng: o.lng,
      userDistanceKm: o.userDistanceKm,
    }));

    // Dedup: drop OSM entries that are within ~110 m of a seed entry.
    const finalList: Array<(typeof sorted)[number] | (typeof opSorted)[number]> = [
      ...sorted,
    ];
    for (const o of opSorted) {
      const collide = sorted.find(
        (s) => Math.abs(s.lat - o.lat) < 0.001 && Math.abs(s.lng - o.lng) < 0.001
      );
      if (!collide) finalList.push(o);
    }
    finalList.sort((a, b) => a.userDistanceKm - b.userDistanceKm);

    // Keep only places WITHIN the chosen radius — "within 8 km" means 8 km.
    const withinRadius = finalList.filter((item) => item.userDistanceKm <= radiusKm);

    // Text search.
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return withinRadius.filter((item) => {
        const name =
          item.kind === "seed" ? item.seed.name.toLowerCase() : item.osm.name.toLowerCase();
        return name.includes(q);
      });
    }
    return withinRadius;
  }, [seed, nearbySeed, overpass, group, coords, query, radiusKm]);

  return (
    <div className="mt-4 flex flex-col">
      {/* Controls — a prominent, sticky search bar on mobile; an inline row on
          desktop (lg:) exactly as before. Ordered first on mobile, second on lg. */}
      <div className="order-1 -mx-4 sticky top-16 z-10 bg-white/90 px-4 py-2 backdrop-blur lg:static lg:order-2 lg:mx-0 lg:mt-3 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
          <div className="relative flex-1 lg:min-w-[12rem]">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 lg:left-3.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nearby places…"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-3 text-[15px] outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)] lg:py-2.5 lg:pl-10 lg:text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="shrink-0 font-medium text-slate-500">Within</span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="min-h-[44px] flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)] lg:min-h-0 lg:flex-none lg:py-2.5"
            >
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={8}>8 km</option>
              <option value={15}>15 km</option>
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category pill rail — a horizontal scroll rail. First on lg, below the
          search on mobile. */}
      <div className="order-2 mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-1 no-scrollbar lg:order-1 lg:mt-0 lg:pt-0">
        {GROUPS.map((g) => (
          <button
            key={g.slug}
            type="button"
            onClick={() => setGroup(g.slug)}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 lg:min-h-[40px] lg:px-3.5 ${
              group === g.slug
                ? "border-transparent bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>{g.emoji}</span>
            {g.label}
          </button>
        ))}
      </div>

      <p className="order-3 mt-2 text-xs font-medium text-slate-500">
        {loading ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Finding places near you…
          </span>
        ) : (
          <>
            {unified.length} {unified.length === 1 ? "place" : "places"} nearby
          </>
        )}
      </p>

      {unified.length === 0 && !loading ? (
        <EmptyState
          className="order-4 mt-6"
          illustration={NoDataIllustration}
          title="No matches."
          description="Try a wider radius or a different category."
        />
      ) : (
        <div className="order-4 mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-3">
          {unified.map((u) =>
            u.kind === "seed" ? (
              <SeedCard key={u.key} place={u.seed} userDistanceKm={u.userDistanceKm} />
            ) : (
              <OsmCard key={u.key} place={u.osm} userDistanceKm={u.userDistanceKm} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function SeedCard({
  place,
  userDistanceKm,
}: {
  place: CityPlace;
  userDistanceKm: number;
}) {
  return (
    <article className="card-hover flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:border-emerald-100 lg:bg-emerald-50/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            ★ Curated · {place.kind}
          </p>
          <p className="mt-0.5 text-[15px] font-extrabold tracking-tight text-slate-900 lg:text-base">{place.name}</p>
          <p className="text-xs font-medium text-slate-500">{place.area ?? place.city}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          <Navigation className="h-3 w-3" /> {formatKm(userDistanceKm)}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-700">{place.shortDescription}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
        {place.entryFeePerPerson > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            {formatINR(place.entryFeePerPerson)} entry
          </span>
        ) : (
          place.avgCostForTwo != null && (
            <span className="inline-flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              {formatINR(place.avgCostForTwo)} for two
            </span>
          )
        )}
        {place.openTime && place.closeTime && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {place.openTime}–{place.closeTime}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {formatMinutes(place.idealMinutesAtPlace)} typical
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/explore-bangalore/${place.slug}`}
          className="inline-flex min-h-[44px] items-center rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-5 text-sm font-bold text-white shadow-md shadow-emerald-500/30 transition hover:scale-[1.03] active:scale-95 lg:h-9 lg:min-h-0 lg:px-4 lg:text-xs"
        >
          Details
        </Link>
        <a
          href={placeMapUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:h-9 lg:min-h-0 lg:px-4 lg:text-xs"
        >
          Map <ExternalLink className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
        </a>
      </div>
    </article>
  );
}

function OsmCard({
  place,
  userDistanceKm,
}: {
  place: OverpassPlaceClient;
  userDistanceKm: number;
}) {
  const groupSlug = OVERPASS_TO_GROUP[place.category] ?? "heritage";
  const group = GROUPS.find((g) => g.slug === groupSlug);
  return (
    <article className="card-hover flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {group?.emoji} Live · {place.category.replace("_", " ")}
          </p>
          <p className="mt-0.5 text-[15px] font-extrabold tracking-tight text-slate-900 lg:text-base">{place.name}</p>
          {place.tags.addrFull && (
            <p className="line-clamp-1 text-xs font-medium text-slate-500">{place.tags.addrFull}</p>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          <Navigation className="h-3 w-3" /> {formatKm(userDistanceKm)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
        {place.tags.cuisine && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
            {place.tags.cuisine}
          </span>
        )}
        {place.tags.openingHours && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {place.tags.openingHours.length > 22
              ? `${place.tags.openingHours.slice(0, 22)}…`
              : place.tags.openingHours}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={placeMapUrl({ name: place.name, area: place.tags.addrFull, latitude: place.lat, longitude: place.lng })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-5 text-sm font-bold text-white shadow-md shadow-emerald-500/30 transition active:scale-95 lg:h-9 lg:min-h-0 lg:bg-none lg:bg-slate-100 lg:px-4 lg:text-xs lg:font-semibold lg:text-slate-700 lg:shadow-none lg:hover:bg-slate-200"
        >
          Map <ExternalLink className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
        </a>
        <a
          href={`https://www.openstreetmap.org/${place.osmId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 lg:h-9 lg:min-h-0 lg:px-4 lg:text-xs"
        >
          OSM <ExternalLink className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
        </a>
        {place.tags.website && (
          <a
            href={place.tags.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 lg:h-9 lg:min-h-0 lg:px-4 lg:text-xs"
          >
            Site <ExternalLink className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
          </a>
        )}
      </div>
    </article>
  );
}
