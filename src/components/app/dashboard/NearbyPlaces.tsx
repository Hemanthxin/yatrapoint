"use client";

// Dashboard "Near by place" — the places genuinely CLOSEST to the traveller,
// mirroring the Explore Bengaluru page: it starts from a server-passed seed,
// then (once we know the user's location) pulls the nearest curated city places
// from /api/nearby-places and shows the four closest, with real m/km distances.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Heart } from "lucide-react";
import type { CityPlace } from "@/lib/db/schema";
import { useLocation } from "@/components/app/LocationContext";
import { sortByUserDistance } from "@/lib/nearby-utils";
import { formatKm } from "@/lib/geo";
import { PlaceImage } from "@/components/app/PlaceImage";

const GRADIENTS = [
  "from-emerald-400 to-green-600",
  "from-teal-400 to-emerald-600",
  "from-sky-400 to-emerald-500",
  "from-lime-400 to-green-600",
];

export function NearbyPlaces({ seed }: { seed: CityPlace[] }) {
  const { coords } = useLocation();
  const [places, setPlaces] = useState<CityPlace[]>(seed);

  // Once we have coordinates, fetch the real nearest curated places.
  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      lat: String(coords.lat),
      lng: String(coords.lng),
      radiusKm: "15",
      limit: "24",
    });
    fetch(`/api/nearby-places?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d?.places?.length) setPlaces(d.places as CityPlace[]);
      })
      .catch(() => {
        /* keep the seed on failure */
      });
    return () => ctrl.abort();
  }, [coords]);

  const nearest = useMemo(
    () => sortByUserDistance(places, coords).slice(0, 4),
    [places, coords]
  );

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {nearest.map((p, i) => (
        <Link
          key={p.id}
          href={`/explore-bangalore/${p.slug}`}
          className="card-hover group relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm"
        >
          <div className="relative h-32 w-full">
            <PlaceImage
              name={p.name}
              storedSrc={p.imageUrl}
              hint={[p.area, p.city].filter(Boolean).join(", ")}
              category={p.category}
              emoji="📍"
              gradient={GRADIENTS[i % GRADIENTS.length]}
              className="h-full w-full"
              emojiClassName="text-4xl"
              preferWiki
            />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              {formatKm(p.userDistanceKm)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{p.name}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                <MapPin className="h-3 w-3 shrink-0" /> {p.area || p.city}
              </p>
            </div>
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--border)] text-slate-300 transition group-hover:border-rose-200 group-hover:text-rose-400"
            >
              <Heart className="h-4 w-4" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
