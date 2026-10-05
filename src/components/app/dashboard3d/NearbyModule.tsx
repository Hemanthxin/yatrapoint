"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { NearPlace } from "@/app/api/nearby-places/route";
import { useLocation } from "@/components/app/LocationContext";
import { formatKm } from "@/lib/geo";

// Real nearby places from the traveller's actual live location — the flat
// dashboard's NearbyPlaces widget does this with curated + live-OSM sources
// merged and re-ranked by driving distance; this deep-dive panel just needs a
// short, honest list, so it's the single curated /api/nearby-places call
// (already sorted by real straight-line distance server-side), not the full
// multi-source pipeline. Replaces the old static `citySeed` slice, which was
// a popularity seed for a *default* city, not anything near the user.
export function useNearbyPlaces(limit = 5) {
  const { coords, status, request } = useLocation();
  const [places, setPlaces] = useState<NearPlace[] | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  useEffect(() => {
    if (status === "idle") request();
  }, [status, request]);

  // Wait for geolocation to settle before fetching — firing on the
  // placeholder fallback coords too (while still "idle"/"prompting") just
  // wastes a request that's immediately superseded once the real fix lands.
  const ready = status === "granted" || status === "denied" || status === "unavailable";

  // Deliberately NOT depending on `coords` here: once a fix is granted,
  // LocationContext keeps refining GPS accuracy for up to 15s, handing out a
  // new `coords` object every time. The nearby-places query takes a few
  // seconds (large catalogue, text lat/lng columns with no index), so
  // re-running this effect on every refinement tick was aborting the
  // in-flight request before it ever had a chance to finish — the panel
  // never resolved. A few metres of GPS refinement doesn't change which
  // places are "nearby" anyway, so one fetch per location fix is enough.
  useEffect(() => {
    if (!ready) return;
    const { lat, lng } = coordsRef.current;
    const ctrl = new AbortController();
    fetch(`/api/nearby-places?lat=${lat}&lng=${lng}&radiusKm=30&limit=${limit}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (Array.isArray(d?.places)) setPlaces(d.places as NearPlace[]);
        else throw new Error("Malformed response");
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        // Transient backend hiccups do happen — retry once rather than
        // leaving the panel stuck on "Finding places near you…" forever.
        setTimeout(() => setRetryTick((n) => n + 1), 1500);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, ready, retryTick]);

  return places;
}

export function NearbyDeepDive() {
  const places = useNearbyPlaces(5);

  if (places === null) {
    return <p className="text-sm text-slate-500">Finding places near you…</p>;
  }
  if (places.length === 0) {
    return <p className="text-sm text-slate-600">Allow location access to see what's genuinely near you.</p>;
  }
  return (
    <ul className="space-y-2">
      {places.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-3 py-2">
          <span className="min-w-0 truncate text-sm font-medium text-slate-800">{p.name}</span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <MapPin className="h-3 w-3" /> {formatKm(p.distanceKm)}
          </span>
        </li>
      ))}
    </ul>
  );
}
