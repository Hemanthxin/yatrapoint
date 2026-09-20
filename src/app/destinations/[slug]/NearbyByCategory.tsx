"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Navigation } from "lucide-react";
import { formatKm, haversineKm } from "@/lib/geo";
import { placeMapUrl } from "@/lib/maps";
import { PlaceImage } from "@/components/app/PlaceImage";

export interface OsmPlace {
  osmId: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  imageUrl?: string | null;
  tags: { cuisine?: string; openingHours?: string; website?: string; addrFull?: string };
}

export const FOOD_CATEGORIES = ["restaurant", "cafe", "fast_food"];
export const SHOP_CATEGORIES = ["mall", "marketplace"];

export interface NearbyAmenities {
  loading: boolean;
  error: string | null;
  food: OsmPlace[];
  shopping: OsmPlace[];
}

// ONE live OpenStreetMap lookup around a place, covering both the food and the
// shopping categories, shared by the teaser counts and by the tab lists.
//
// Fetched once rather than per section: the teasers have to state a real number
// of places ("24 within 2 km"), and a count you can only get by asking is not
// something to guess at — but asking twice for what one query answers would be
// two Overpass round-trips on every place screen.
export function useNearbyAmenities(
  lat: number,
  lng: number,
  enabled: boolean,
  radiusM = 2000,
  // Places already seeded in our own catalogue, passed down from the server.
  // These render immediately and are the reason the tabs work at all outside
  // Bengaluru; the live lookup below only ever ADDS to them.
  seeded: { food: OsmPlace[]; shopping: OsmPlace[] } = { food: [], shopping: [] }
): NearbyAmenities {
  const [state, setState] = useState<NearbyAmenities>({
    // Seeded rows are already here, so the list is never in a loading state
    // with content available to show.
    loading: enabled && seeded.food.length === 0 && seeded.shopping.length === 0,
    error: null,
    food: seeded.food,
    shopping: seeded.shopping,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, error: null, food: seeded.food, shopping: seeded.shopping });
      return;
    }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: String(radiusM),
      categories: [...FOOD_CATEGORIES, ...SHOP_CATEGORIES].join(","),
      limit: "60",
    });
    fetch(`/api/overpass/places?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.ok) throw new Error(data.error || "Lookup failed");
        const places = (data.places ?? []) as OsmPlace[];
        const near = (p: OsmPlace) => haversineKm({ lat, lng }, { lat: p.lat, lng: p.lng });
        const sort = (a: OsmPlace, b: OsmPlace) => near(a) - near(b);

        // Merge live results INTO the seeded ones rather than replacing them.
        // Both sides come from OpenStreetMap, so the same restaurant can appear
        // twice — once seeded (slug key) and once live (osm id key). Matching on
        // name + rounded coordinates catches that; the seeded row wins, because
        // it is the one carrying a resolved photo.
        const merge = (base: OsmPlace[], extra: OsmPlace[]) => {
          const seen = new Set(
            base.map((p) => `${p.name.toLowerCase()}@${p.lat.toFixed(4)},${p.lng.toFixed(4)}`)
          );
          const out = [...base];
          for (const p of extra) {
            const key = `${p.name.toLowerCase()}@${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(p);
          }
          return out.sort(sort);
        };

        setState({
          loading: false,
          error: null,
          food: merge(seeded.food, places.filter((p) => FOOD_CATEGORIES.includes(p.category))),
          shopping: merge(
            seeded.shopping,
            places.filter((p) => SHOP_CATEGORIES.includes(p.category))
          ),
        });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        // A failed live lookup must not wipe out what we already have. Only a
        // place with nothing seeded shows the error.
        const hasSeeded = seeded.food.length > 0 || seeded.shopping.length > 0;
        setState({
          loading: false,
          error: hasSeeded ? null : "Couldn't load these right now.",
          food: seeded.food,
          shopping: seeded.shopping,
        });
      });
    return () => ctrl.abort();
  }, [lat, lng, enabled, radiusM]);

  return state;
}

// Presentational list. Every row links to the real place on the map — nothing
// here is summarised or averaged, so nothing here can be wrong.
export function NearbyList({
  places,
  origin,
  kind,
  loading,
  error,
  emptyLabel,
}: {
  places: OsmPlace[];
  origin: { lat: number; lng: number };
  kind: "food" | "shopping";
  loading: boolean;
  error: string | null;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }
  if (error || places.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
        {error ?? emptyLabel}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {places.map((p) => (
        <li key={p.osmId}>
          <a
            href={placeMapUrl({ name: p.name, area: p.tags.addrFull, latitude: p.lat, longitude: p.lng })}
            target="_blank"
            rel="noopener noreferrer"
            className="card card-hover flex items-center gap-3 p-3"
          >
            {/* The place's own photo where OpenStreetMap carries one (an
                `image` or `wikimedia_commons` tag), otherwise a category tile.
                Most eateries have no photo in OSM and we do not invent one —
                an emoji tile is honest, a stock photo of someone else's
                restaurant would not be. */}
            <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              <PlaceImage
                name={p.name}
                storedSrc={p.imageUrl}
                emoji={kind === "food" ? "🍽️" : "🛍️"}
                gradient={
                  kind === "food"
                    ? "from-amber-400 to-orange-500"
                    : "from-violet-400 to-fuchsia-500"
                }
                className="h-14 w-14"
                emojiClassName="text-xl"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-slate-900">{p.name}</span>
              <span className="block truncate text-xs text-slate-500">
                {p.tags.cuisine ? `${p.tags.cuisine} · ` : ""}
                {p.tags.addrFull || p.category.replace(/_/g, " ")}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600">
              <Navigation className="h-3 w-3" />
              {formatKm(haversineKm(origin, { lat: p.lat, lng: p.lng }))}
              <ExternalLink className="ml-1 h-3 w-3 text-slate-400" />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
