"use client";

import { useEffect, useState } from "react";
import { Clock, ExternalLink, Loader2, Navigation } from "lucide-react";
import { formatKm, haversineKm } from "@/lib/geo";

interface OsmPlace {
  osmId: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  tags: {
    cuisine?: string;
    openingHours?: string;
    website?: string;
    addrFull?: string;
  };
}

interface NearbyRestaurantsProps {
  centreLat: number;
  centreLng: number;
}

export function NearbyRestaurants({ centreLat, centreLng }: NearbyRestaurantsProps) {
  const [places, setPlaces] = useState<OsmPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      lat: String(centreLat),
      lng: String(centreLng),
      radius: "1500",
      categories: "restaurant,cafe,fast_food",
      limit: "30",
    });
    fetch(`/api/overpass/places?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.ok) throw new Error(data.error || "Overpass failed");
        setPlaces(
          (data.places as OsmPlace[])
            .map((p) => ({
              ...p,
              _dist: haversineKm({ lat: centreLat, lng: centreLng }, { lat: p.lat, lng: p.lng }),
            }))
            .sort(
              (a, b) =>
                (a as OsmPlace & { _dist: number })._dist -
                (b as OsmPlace & { _dist: number })._dist
            )
        );
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [centreLat, centreLng]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Fetching live restaurants…
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-amber-600">{error}</p>;
  }
  if (places.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No restaurants tagged in OpenStreetMap within 1.5 km.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {places.slice(0, 18).map((p) => {
        const dist = haversineKm(
          { lat: centreLat, lng: centreLng },
          { lat: p.lat, lng: p.lng }
        );
        return (
          <li
            key={p.osmId}
            className="card-hover flex flex-col rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {p.category.replace("_", " ")}
                </p>
                <p className="mt-0.5 truncate font-extrabold tracking-tight text-slate-900">{p.name}</p>
                {p.tags.cuisine && (
                  <p className="line-clamp-1 text-xs font-medium text-slate-500">
                    {p.tags.cuisine.replaceAll(";", " · ")}
                  </p>
                )}
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                <Navigation className="h-3 w-3" />
                {formatKm(dist)}
              </span>
            </div>
            {p.tags.openingHours && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                {p.tags.openingHours.length > 30
                  ? `${p.tags.openingHours.slice(0, 30)}…`
                  : p.tags.openingHours}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <a
                href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Map <ExternalLink className="h-3 w-3" />
              </a>
              {p.tags.website && (
                <a
                  href={p.tags.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Site <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
