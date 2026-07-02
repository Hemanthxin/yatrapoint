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

  // Build a unified list: seed + Overpass, dedup by lat/lng proximity, sort by distance.
  const unified = useMemo(() => {
    const seedFiltered = seed.filter((s) => {
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

    // Text search.
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return finalList.filter((item) => {
        const name =
          item.kind === "seed" ? item.seed.name.toLowerCase() : item.osm.name.toLowerCase();
        return name.includes(q);
      });
    }
    return finalList;
  }, [seed, overpass, group, coords, query]);

  const seedCount = unified.filter((u) => u.kind === "seed").length;
  const liveCount = unified.filter((u) => u.kind === "osm").length;

  return (
    <div className="mt-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
        {GROUPS.map((g) => (
          <button
            key={g.slug}
            type="button"
            onClick={() => setGroup(g.slug)}
            className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              group === g.slug
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>{g.emoji}</span>
            {g.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-500">Within</span>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
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

      <p className="mt-2 text-xs font-medium text-slate-500">
        {loading ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Fetching live OSM data…
          </span>
        ) : (
          <>
            {unified.length} {unified.length === 1 ? "place" : "places"} ·{" "}
            {seedCount} curated · {liveCount} live from OpenStreetMap
            {isFallback && " · using fallback location"}
          </>
        )}
        {error && <span className="ml-2 text-amber-600">({error})</span>}
      </p>

      {unified.length === 0 && !loading ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-500">No matches. Try a wider radius or a different category.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    <article className="card-hover flex flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            ★ Curated · {place.kind}
          </p>
          <p className="mt-0.5 font-semibold tracking-tight text-slate-900">{place.name}</p>
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
          className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
        >
          Details
        </Link>
        <a
          href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Map <ExternalLink className="h-3 w-3" />
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
    <article className="card-hover flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {group?.emoji} Live · {place.category.replace("_", " ")}
          </p>
          <p className="mt-0.5 font-semibold tracking-tight text-slate-900">{place.name}</p>
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
          href={`https://www.google.com/maps?q=${place.lat},${place.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1 rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          Map <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href={`https://www.openstreetmap.org/${place.osmId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1 rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          OSM <ExternalLink className="h-3 w-3" />
        </a>
        {place.tags.website && (
          <a
            href={place.tags.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Site <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </article>
  );
}
