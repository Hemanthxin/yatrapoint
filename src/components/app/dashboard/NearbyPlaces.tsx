"use client";

// Dashboard "Near by place" — the places genuinely CLOSEST to the traveller,
// wherever they are. It asks for the real device location, then merges two
// sources so it works anywhere in India:
//   • curated city places  (/api/nearby-places — fast, rich, Bengaluru-heavy)
//   • live OpenStreetMap    (/api/overpass/places — any location on earth)
// Everything is sorted by real distance from you, de-duplicated, nearest four.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Heart } from "lucide-react";
import type { CityPlace } from "@/lib/db/schema";
import type { NearPlace } from "@/app/api/nearby-places/route";
import { useLocation } from "@/components/app/LocationContext";
import { haversineKm, formatKm } from "@/lib/geo";
import { placeMapUrl } from "@/lib/maps";
import { PlaceImage } from "@/components/app/PlaceImage";
import { LocationSearchIllustration } from "@/components/illustrations";

// Detail-page route for a curated place, by which table it came from.
function hrefFor(source: NearPlace["source"], slug: string): string {
  if (source === "destination") return `/destinations/${slug}`;
  if (source === "nearby") return `/one-day-trips/${slug}`;
  return `/explore-bangalore/${slug}`;
}

// First-paint seed (Bengaluru popular city places) normalised to NearPlace.
function seedToNear(p: CityPlace): NearPlace {
  return {
    id: p.id, name: p.name, slug: p.slug, source: "city",
    category: p.category, kind: p.kind, area: p.area || p.city || null,
    imageUrl: p.imageUrl, latitude: p.latitude, longitude: p.longitude, distanceKm: 0,
  };
}

const GRADIENTS = [
  "from-emerald-400 to-green-600",
  "from-teal-400 to-emerald-600",
  "from-sky-400 to-emerald-500",
  "from-lime-400 to-green-600",
];

// Category-appropriate emoji for places with no photo.
const KIND_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", fast_food: "🍔", food: "🍽️",
  nightlife: "🍺", bar: "🍸", pub: "🍺",
  mall: "🛍️", market: "🛒", marketplace: "🛒", shopping: "🛍️",
  temple: "🛕", church: "⛪", mosque: "🕌", gurudwara: "🛕", place_of_worship: "🛕", worship: "🛕",
  museum: "🏛️", monument: "🏛️", heritage: "🏛️", fort: "🏰",
  park: "🌳", garden: "🌷", lake: "🏞️", viewpoint: "🌄", nature: "🌿",
  zoo: "🦁", wildlife: "🦌", amusement: "🎡", attraction: "🎡",
  tourist_attraction: "🎡", cinema: "🎬", theatre: "🎭",
};
function emojiFor(kind?: string | null): string {
  return KIND_EMOJI[(kind ?? "").toLowerCase()] ?? "📍";
}
function labelOf(category?: string | null): string {
  if (!category) return "Nearby";
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Live-OSM categories we pull for the dashboard (broad, but the useful ones).
const OSM_CATEGORIES =
  "restaurant,cafe,temple,church,mosque,park,garden,museum,viewpoint,lake,monument,fort,tourist_attraction,marketplace,mall,nightlife";

interface OverpassLite {
  osmId: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  tags?: { addrFull?: string };
}

interface NearItem {
  key: string;
  name: string;
  href: string;
  external: boolean;
  lat: number;
  lng: number;
  area: string | null;
  imageSrc: string | null;
  emoji: string;
  distanceKm: number;
}

export function NearbyPlaces({ seed }: { seed: CityPlace[] }) {
  const { coords, status, request } = useLocation();
  const [curated, setCurated] = useState<NearPlace[]>(() => seed.map(seedToNear));
  const [live, setLive] = useState<OverpassLite[]>([]);

  // Ask for the device's real location once, so "near by" is actually near you.
  useEffect(() => {
    if (status === "idle") request();
  }, [status, request]);

  // Pull both sources whenever the location changes.
  useEffect(() => {
    const ctrl = new AbortController();
    const q = `lat=${coords.lat}&lng=${coords.lng}`;

    fetch(`/api/nearby-places?${q}&radiusKm=30&limit=24`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.places)) setCurated(d.places as NearPlace[]);
      })
      .catch(() => {});

    fetch(`/api/overpass/places?${q}&radius=6000&categories=${OSM_CATEGORIES}&limit=60`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.places)) setLive(d.places as OverpassLite[]);
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [coords]);

  // Haversine (straight-line) shortlist — instant, no network. Wider than the
  // final 4 so there's real choice left for the driving-distance re-rank
  // below to work with (the nearest-as-the-crow-flies place isn't always the
  // nearest by road).
  const shortlist = useMemo(() => {
    const items: NearItem[] = [];

    for (const p of curated) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      const d = haversineKm(coords, { lat, lng });
      if (!p.name || !Number.isFinite(d)) continue;
      items.push({
        key: `c:${p.id}`,
        name: p.name,
        href: hrefFor(p.source, p.slug),
        external: false,
        lat,
        lng,
        area: p.area,
        imageSrc: p.imageUrl ?? null,
        emoji: emojiFor(p.kind || p.category),
        distanceKm: d,
      });
    }

    for (const o of live) {
      const d = haversineKm(coords, { lat: o.lat, lng: o.lng });
      if (!o.name || !Number.isFinite(d)) continue;
      items.push({
        key: `o:${o.osmId}`,
        name: o.name,
        href: placeMapUrl({ name: o.name, latitude: o.lat, longitude: o.lng }),
        external: true,
        lat: o.lat,
        lng: o.lng,
        area: o.tags?.addrFull || labelOf(o.category),
        imageSrc: null,
        emoji: emojiFor(o.category),
        distanceKm: d,
      });
    }

    items.sort((a, b) => a.distanceKm - b.distanceKm);

    // De-dup places within ~120 m of one already chosen; keep the nearest 16
    // as candidates for the real-driving-distance re-rank.
    const out: NearItem[] = [];
    for (const it of items) {
      if (out.some((o) => haversineKm({ lat: o.lat, lng: o.lng }, { lat: it.lat, lng: it.lng }) < 0.12)) {
        continue;
      }
      out.push(it);
      if (out.length >= 16) break;
    }
    return out;
  }, [curated, live, coords]);

  // Upgrade the shortlist to real driving distance (Google Distance Matrix),
  // then re-rank and keep the nearest four BY ROAD — falls straight back to
  // the haversine shortlist (already sorted, already deduped) if the call
  // fails, so this can never leave the widget empty or broken.
  const [refined, setRefined] = useState<NearItem[] | null>(null);
  useEffect(() => {
    if (shortlist.length === 0) {
      setRefined(null);
      return;
    }
    const ctrl = new AbortController();
    fetch("/api/driving-distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: coords,
        destinations: shortlist.map((p) => ({ lat: p.lat, lng: p.lng })),
      }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        const km: (number | null)[] = Array.isArray(d?.distancesKm) ? d.distancesKm : [];
        const withReal = shortlist.map((p, i) => ({ ...p, distanceKm: km[i] ?? p.distanceKm }));
        withReal.sort((a, b) => a.distanceKm - b.distanceKm);
        setRefined(withReal.slice(0, 4));
      })
      .catch(() => {
        // keep whatever the haversine fallback below is already showing
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortlist]);

  const nearest = refined ?? shortlist.slice(0, 4);

  if (nearest.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-8 text-center">
        <LocationSearchIllustration className="mx-auto h-24 w-24" />
        <p className="mt-2 text-sm font-semibold text-slate-600">Finding places near you…</p>
        <p className="mt-0.5 text-xs text-slate-400">Allow location access for the closest spots.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {nearest.map((p, i) => {
        const inner = (
          <>
            <div className="relative h-32 w-full">
              <PlaceImage
                name={p.name}
                storedSrc={p.imageSrc}
                hint={p.area ?? undefined}
                emoji={p.emoji}
                gradient={GRADIENTS[i % GRADIENTS.length]}
                className="h-full w-full"
                emojiClassName="text-4xl"
                preferWiki
              />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                {formatKm(p.distanceKm)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{p.name}</p>
                <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0" /> {p.area || "Nearby"}
                </p>
              </div>
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--border)] text-slate-300 transition group-hover:border-rose-200 group-hover:text-rose-400"
              >
                <Heart className="h-4 w-4" />
              </span>
            </div>
          </>
        );
        const cls =
          "card-hover group relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm";
        return p.external ? (
          <a key={p.key} href={p.href} target="_blank" rel="noopener noreferrer" className={cls}>
            {inner}
          </a>
        ) : (
          <Link key={p.key} href={p.href} className={cls}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
