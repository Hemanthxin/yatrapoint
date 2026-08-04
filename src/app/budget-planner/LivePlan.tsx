"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Play,
  Wallet,
  LocateFixed,
  RefreshCw,
  ExternalLink,
  Share2,
  Check,
  Repeat,
  X,
  TrainFront,
  Car,
  Bike,
  BedDouble,
  Star,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
} from "lucide-react";

import { useLocation } from "@/components/app/LocationContext";
import { SaaferaLoader } from "@/components/app/SaaferaLoader";
import { PlaceImage } from "@/components/app/PlaceImage";
import { StopImageGrid } from "./StopImageGrid";
import { formatINR } from "@/lib/format";
import { formatKm, formatMinutes, haversineKm } from "@/lib/geo";
import { placeMapUrl } from "@/lib/maps";
import { VEHICLES, type VehicleKind } from "@/lib/budget";

// Fallback tile look (emoji + gradient) per Overpass category, shown until a
// stop has a real stored photo (admin-added or curated).
const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", fast_food: "🍔", nightlife: "🍻", mall: "🛍️", marketplace: "🧺",
  temple: "🛕", church: "⛪", mosque: "🕌", gurudwara: "🛐", place_of_worship: "🛐",
  park: "🌳", garden: "🌷", museum: "🏛️", viewpoint: "🌄", monument: "🏯", fort: "🏰",
  lake: "💧", tourist_attraction: "📍", cinema: "🎬", theatre: "🎭", zoo: "🦁", amusement: "🎢", station: "🚉",
};
const CATEGORY_TILE_GRADIENT: Record<string, string> = {
  restaurant: "from-amber-400 to-orange-500", cafe: "from-amber-300 to-amber-600", fast_food: "from-orange-400 to-red-500",
  nightlife: "from-fuchsia-500 to-purple-700", mall: "from-sky-400 to-blue-600", marketplace: "from-yellow-500 to-amber-700",
  temple: "from-orange-400 to-red-500", church: "from-slate-400 to-slate-600", mosque: "from-emerald-500 to-teal-700",
  gurudwara: "from-blue-400 to-indigo-600", place_of_worship: "from-orange-400 to-red-500",
  park: "from-lime-500 to-green-700", garden: "from-green-400 to-emerald-600", museum: "from-violet-500 to-purple-700",
  viewpoint: "from-sky-400 to-emerald-500", monument: "from-rose-500 to-red-700", fort: "from-stone-500 to-stone-700",
  lake: "from-cyan-400 to-blue-600", tourist_attraction: "from-emerald-400 to-teal-600", cinema: "from-red-500 to-rose-700",
  theatre: "from-purple-500 to-fuchsia-700", zoo: "from-lime-500 to-emerald-700", amusement: "from-pink-500 to-rose-600",
  station: "from-slate-500 to-slate-700",
};
import { groupsToOverpass } from "@/lib/catalog/place-groups";
import { Reveal } from "@/components/app/Reveal";

const TripMap = dynamic(() => import("@/components/map/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

interface PlanStop {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  entryFee: number;
  entryFeeKnown?: boolean;
  idealMinutes: number;
  stopCost: number;
  travelCost: number;
  arrivalKmFromPrev: number;
  arrivalMinutesFromPrev: number;
  imageUrl?: string | null;
  images?: { url: string; caption: string | null }[];
  meta?: { osmId?: string; citySeedSlug?: string };
}

// A candidate the planner considered but didn't include — offered as a swap.
interface Alternative {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  entryFee: number;
  entryFeeKnown?: boolean;
  idealMinutes: number;
  foodCostPerPerson?: number;
  imageUrl?: string | null;
  images?: { url: string; caption: string | null }[];
  meta?: { osmId?: string; citySeedSlug?: string };
}

interface PlanResponse {
  ok: boolean;
  error?: string;
  stops: PlanStop[];
  alternatives?: Alternative[];
  mode?: string;
  travelLabel?: string;
  travelPerPerson?: boolean;
  inBengaluru?: boolean;
  modeOptions?: {
    mode: string;
    label: string;
    cost: number;
    durationMinutes: number;
    fareLabel: string;
    cheapest: boolean;
    fastest: boolean;
    recommended: boolean;
  }[];
  trainInfo?: {
    board: { name: string; lat: number; lng: number; km: number; halt: boolean } | null;
    dest: { name: string; lat: number; lng: number; km: number; halt: boolean } | null;
  } | null;
  staySuggestion?: {
    name: string;
    area: string | null;
    city: string | null;
    pricePerNight: number;
    rating: number | null;
    nights: number;
    rooms: number;
    total: number;
    bookUrl: string;
  } | null;
  totals: {
    distanceKm: number;
    durationMinutes: number;
    cost: number;
    perPersonCost: number;
    fuelTotal: number;
    entryFeesTotal: number;
    foodTotal: number;
    stayTotal?: number;
    stayNightly?: number;
    stayNights?: number;
    stayRooms?: number;
    unspentBudget: number;
    unspentMinutes: number;
  };
  geometry: [number, number][] | null;
  legs: Array<{ distanceKm: number; durationMinutes: number }> | null;
  candidatesConsidered: number;
  overpassPlaces: number;
  seedPlaces: number;
  overpassError?: string | null;
}

const PLAN_STORAGE_KEY = "yatra-point/multi-stop-plan";
const PLAN_CACHE_KEY = "yatra-point/budget-plan-cache";
const SAVED_TRIPS_KEY = "yatra-point/saved-trips";

export interface LivePlanProps {
  budget: number;
  people: number;
  hours: number;
  vehicle: VehicleKind;
  groups: string[];
  includeFood: boolean;
  // Optional user-entered food budget for the whole trip (INR). null → the
  // planner estimates ₹350/person/day. Ignored when includeFood is false.
  foodBudget?: number | null;
  maxStops: number;
  radiusKm?: number;
  days?: number;
  // When planning a chosen area (state / district / taluk) instead of "around
  // me", these override the live GPS origin and add hand-picked catalogue stops.
  originOverride?: { lat: number; lng: number; label?: string } | null;
  placeIds?: string[];
  // In area mode, the chosen district(s)/taluk — restricts the curated
  // catalogue so only places from that area appear.
  areaDistricts?: string[];
  // Travel mode — "any" | "car" | "bike" | "bus" | "train" | "flight". Drives
  // the cost model and the map style (road route vs rail line vs flight arc).
  mode?: string;
  // "Around me" planning only: the minimum distance (km) a place must be from
  // the traveller, and the compass direction to head ("any" = full circle).
  minDistanceKm?: number;
  direction?: string;
}

export function LivePlan({
  budget,
  people,
  hours,
  vehicle,
  groups,
  includeFood,
  foodBudget = null,
  maxStops,
  radiusKm = 25,
  days = 1,
  originOverride = null,
  placeIds = [],
  areaDistricts = [],
  mode = "any",
  minDistanceKm = 0,
  direction = "any",
}: LivePlanProps) {
  const router = useRouter();
  const live = useLocation();

  // The route + map ALWAYS start from the traveller's LIVE location (the green
  // pin). In area mode the chosen area's centre is used only to DISCOVER places
  // — never as the start — so the map always reflects where the user actually is.
  const coords = live.coords;
  const start = coords;
  const searchCentre = originOverride
    ? { lat: originOverride.lat, lng: originOverride.lng }
    : live.coords;

  const status = live.status;
  const accuracyMeters = live.accuracyMeters;
  const isFallback = live.isFallback;
  const request = live.request;

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  const didAutoRun = useRef(false);
  // Mirrors `plan` for `generate` to read without becoming stale — keeps
  // Regenerate from being recreated (and re-triggering the auto-run effect)
  // every time a plan lands, while still letting it see the LATEST plan's
  // stops so it can steer the next generation away from repeating them.
  const planRef = useRef<PlanResponse | null>(null);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  // "Already visited / replace this place" — which stop's swap panel is open,
  // and whether a re-route is in flight.
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Which map view is showing — the traveller can flip the SAME trip between
  // road / bike / rail / flight map styles (no re-costing; just the map).
  // Bike shares the road's real routed geometry (same roads); only train
  // falls back to a straight-line preview since there's no rail geometry.
  const [mapMode, setMapMode] = useState<"road" | "bike" | "train">(
    mode === "bike" ? "bike" : mode === "train" ? "train" : "road"
  );

  const overpassCategories = useMemo(() => groupsToOverpass(groups), [groups]);

  // Signature of the inputs — lets us restore a cached plan only when it still
  // matches the current selections.
  const sig = useMemo(
    () => JSON.stringify({ budget, people, hours, vehicle, groups, includeFood, foodBudget, maxStops, radiusKm, days, originOverride, placeIds, areaDistricts, mode, minDistanceKm, direction }),
    [budget, people, hours, vehicle, groups, includeFood, foodBudget, maxStops, radiusKm, days, originOverride, placeIds, areaDistricts, mode, minDistanceKm, direction]
  );

  const generate = useCallback(async () => {
    if (overpassCategories.length === 0 && placeIds.length === 0) {
      setError("Pick at least one place type, or choose specific places above.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Regenerate: steer away from repeating the same stops when a plan
      // already exists — the backend treats this as a soft preference, so a
      // thin pool still falls back to a repeat rather than losing stops.
      const excludeIds = planRef.current?.stops.map((s) => s.id) ?? [];
      const res = await fetch("/api/multi-stop/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { lat: start.lat, lng: start.lng },
          searchCentre,
          totalBudget: budget,
          hours,
          people,
          vehicle,
          categories: overpassCategories,
          includePlaceIds: placeIds,
          includeFood,
          foodBudget,
          maxStops,
          searchRadiusKm: radiusKm,
          minDistanceKm,
          direction,
          areaDistricts,
          mode,
          days,
          excludeIds,
        }),
      });
      const data: PlanResponse = await res.json();
      if (!res.ok || !data.ok) {
        const detail = data.overpassError ? ` (live-places lookup: ${data.overpassError})` : "";
        setError((data.error || "Could not generate a plan.") + detail);
        setPlan(null);
        return;
      }
      setPlan(data);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }, [start.lat, start.lng, searchCentre.lat, searchCentre.lng, budget, hours, people, vehicle, overpassCategories, placeIds, includeFood, foodBudget, maxStops, radiusKm, minDistanceKm, direction, areaDistricts, mode, days]);

  // Restore a previously generated plan on mount (e.g. after visiting a place
  // and pressing Back) so it isn't lost. Only if the inputs still match.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PLAN_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { sig: string; plan: PlanResponse };
        if (cached?.sig === sig && cached.plan) {
          setPlan(cached.plan);
          didAutoRun.current = true; // don't auto-regenerate over the restored plan
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cache the plan whenever it changes so Back-navigation can restore it.
  useEffect(() => {
    if (plan) {
      try {
        sessionStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ sig, plan }));
      } catch {
        // ignore (quota)
      }
    }
  }, [plan, sig]);

  // Ask for live location on mount — even in area mode, so we can start the
  // route from where the traveller actually is when they're inside the area.
  useEffect(() => {
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate once, after location settles (granted, denied or fallback).
  useEffect(() => {
    if (didAutoRun.current) return;
    if (status === "idle" || status === "prompting") return;
    didAutoRun.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const stopMarkers = useMemo(
    () => plan?.stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name })) ?? [],
    [plan?.stops]
  );

  // A train route only exists when we actually found a boarding AND an alighting
  // station near the trip. Without both, there's no rail line to draw.
  const hasTrainRoute = !!(plan?.trainInfo?.board && plan?.trainInfo?.dest);

  // Split the stops across the chosen days as EVENLY as possible so a multi-day
  // trip genuinely shows a plan for every day (e.g. "2 Days" always yields a
  // Day 1 and Day 2 when there are at least two stops), rather than cramming
  // everything into day one. Stops keep their optimal order within each day.
  const dayBuckets = useMemo(() => {
    if (!plan || plan.stops.length === 0) return [] as PlanStop[][];
    const nDays = Math.max(1, days);
    if (nDays === 1) return [plan.stops];
    const stops = plan.stops;
    const base = Math.floor(stops.length / nDays);
    let rem = stops.length % nDays;
    const buckets: PlanStop[][] = [];
    let idx = 0;
    for (let d = 0; d < nDays; d++) {
      const take = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      buckets.push(stops.slice(idx, idx + take));
      idx += take;
    }
    return buckets;
  }, [plan, days]);

  // Same route, opened in Google Maps: start → each stop in order → back to start.
  const googleMapsUrl = useMemo(() => {
    if (!plan || plan.stops.length === 0) return "#";
    const origin = `${start.lat},${start.lng}`;
    const params = new URLSearchParams({
      api: "1",
      origin,
      destination: origin,
      travelmode: "driving",
    });
    const waypoints = plan.stops.map((s) => `${s.lat},${s.lng}`).join("|");
    if (waypoints) params.set("waypoints", waypoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [plan, start.lat, start.lng]);

  // Share the plan to any platform (WhatsApp / Instagram / etc.) via the native
  // share sheet, including the Google Maps route link. Falls back to copying.
  async function sharePlan() {
    if (!plan) return;
    const lines = plan.stops.map((s, i) => `${i + 1}. ${s.name}`).join("\n");
    const text =
      `🗺️ My trip plan — ${plan.stops.length} stops\n${lines}\n\n` +
      `📍 ${formatKm(plan.totals.distanceKm)} · 💰 ${formatINR(plan.totals.cost)} total\n\n` +
      `Open the full route in Google Maps:\n${googleMapsUrl}\n\n— Planned with Saafera`;
    const shareData = { title: "My Trip Plan", text, url: googleMapsUrl };
    // Native share sheet — only in a secure (HTTPS) context on mobile.
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (navigator.canShare?.(shareData) ?? true)
    ) {
      try {
        await navigator.share(shareData);
      } catch {
        // user dismissed the sheet
      }
      return;
    }
    // No Web Share API (desktop / insecure http LAN URL) → real WhatsApp share.
    const win = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    if (!win) {
      try {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } catch {
        // ignore
      }
    }
  }

  // Save the generated plan so the traveller can come back to it. Persists a
  // compact snapshot to localStorage (works offline, no round-trip) and shows a
  // "Saved" confirmation.
  function saveTrip() {
    if (!plan) return;
    try {
      const raw = localStorage.getItem(SAVED_TRIPS_KEY);
      const list: unknown[] = raw ? JSON.parse(raw) : [];
      const label = originOverride?.label
        ? `Trip to ${originOverride.label}`
        : `${plan.stops.length}-stop trip`;
      const entry = {
        id: `trip-${plan.stops.map((s) => s.id).join("-").slice(0, 60)}-${plan.totals.cost}`,
        name: label,
        stops: plan.stops.map((s) => ({ id: s.id, name: s.name, category: s.category, lat: s.lat, lng: s.lng })),
        totals: plan.totals,
        days,
        people,
        mapsUrl: googleMapsUrl,
        savedAt: new Date().toISOString(),
      };
      // De-dup by id; newest first, keep the most recent 30.
      const next = [entry, ...(Array.isArray(list) ? list : []).filter((t) => (t as { id?: string })?.id !== entry.id)].slice(0, 30);
      localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // ignore (quota / disabled storage)
    }
  }

  const isFoodCat = (cat: string) => cat === "restaurant" || cat === "cafe" || cat === "fast_food";

  // Alternatives for a given stop — same category first, then nearest, so the
  // swap list is genuinely relevant ("you've been to this temple → here's
  // another temple close by").
  function alternativesFor(stop: PlanStop): Alternative[] {
    const alts = plan?.alternatives ?? [];
    return [...alts].sort((a, b) => {
      const sameA = a.category === stop.category ? 0 : 1;
      const sameB = b.category === stop.category ? 0 : 1;
      if (sameA !== sameB) return sameA - sameB;
      return (
        haversineKm(stop, { lat: a.lat, lng: a.lng }) -
        haversineKm(stop, { lat: b.lat, lng: b.lng })
      );
    });
  }

  // Swap a stop for an alternative and re-route through the new set of stops.
  async function replaceStop(index: number, alt: Alternative) {
    if (!plan) return;
    setSwapError(null);
    setRerouting(true);
    const removed = plan.stops[index];
    const food = isFoodCat(alt.category);
    const stopCost = Math.round(
      alt.entryFee * people + (food ? (alt.foodCostPerPerson ?? 0) * people : 0)
    );
    const newStop: PlanStop = {
      id: alt.id,
      name: alt.name,
      category: alt.category,
      lat: alt.lat,
      lng: alt.lng,
      entryFee: alt.entryFee,
      entryFeeKnown: alt.entryFeeKnown,
      idealMinutes: alt.idealMinutes,
      stopCost,
      travelCost: 0,
      arrivalKmFromPrev: 0,
      arrivalMinutesFromPrev: 0,
      imageUrl: alt.imageUrl,
      meta: alt.meta,
    };
    const draftStops = plan.stops.map((s, i) => (i === index ? newStop : s));

    try {
      const res = await fetch("/api/multi-stop/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { lat: start.lat, lng: start.lng },
          stops: draftStops.map((s) => ({ lat: s.lat, lng: s.lng })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "route failed");

      const legs: Array<{ distanceKm: number; durationMinutes: number }> = data.legs ?? [];
      const costPerKm = VEHICLES[vehicle].costPerKm;
      const routedStops = draftStops.map((s, k) => {
        const leg = legs[k];
        const km = leg?.distanceKm ?? s.arrivalKmFromPrev;
        return {
          ...s,
          arrivalKmFromPrev: km,
          arrivalMinutesFromPrev: leg?.durationMinutes ?? s.arrivalMinutesFromPrev,
          travelCost: Math.round(km * costPerKm),
        };
      });

      const fuelTotal = Math.round(data.distanceKm * costPerKm);
      const entryFeesTotal = routedStops.reduce((a, s) => a + s.entryFee * people, 0);
      const stopCostTotal = routedStops.reduce((a, s) => a + s.stopCost, 0);
      const foodTotal = Math.max(0, stopCostTotal - entryFeesTotal);
      const cost = fuelTotal + stopCostTotal;
      const visitMin = routedStops.reduce((a, s) => a + s.arrivalMinutesFromPrev + s.idealMinutes, 0);

      // Put the removed place back into the alternatives pool; drop the chosen one.
      const removedAlt: Alternative = {
        id: removed.id,
        name: removed.name,
        category: removed.category,
        lat: removed.lat,
        lng: removed.lng,
        entryFee: removed.entryFee,
        entryFeeKnown: removed.entryFeeKnown,
        idealMinutes: removed.idealMinutes,
        meta: removed.meta,
      };
      const nextAlts = [removedAlt, ...(plan.alternatives ?? []).filter((a) => a.id !== alt.id)];

      setPlan({
        ...plan,
        stops: routedStops,
        geometry: data.geometry ?? plan.geometry,
        legs,
        alternatives: nextAlts,
        totals: {
          ...plan.totals,
          distanceKm: data.distanceKm,
          durationMinutes: data.durationMinutes,
          cost,
          perPersonCost: Math.round(cost / Math.max(1, people)),
          fuelTotal,
          entryFeesTotal,
          foodTotal,
          unspentBudget: Math.max(0, budget - cost),
          unspentMinutes: Math.max(0, Math.round(hours * 60 * 0.85 - visitMin)),
        },
      });
      setSwapIndex(null);
    } catch {
      setSwapError("Couldn't swap that place — please try again.");
    } finally {
      setRerouting(false);
    }
  }

  return (
    <Reveal id="live-plan" className="mt-8 space-y-5 scroll-mt-20" amount={0}>
      {/* Live location banner + regenerate */}
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-emerald-900">
          <LocateFixed className={`h-5 w-5 ${isFallback ? "text-amber-500" : "text-emerald-600"}`} />
          {originOverride
            ? `Exploring ${originOverride.label ?? "your chosen area"} — starting from your location`
            : status === "granted"
            ? "Using your live location"
            : status === "prompting"
            ? "Getting your location…"
            : status === "denied"
            ? "Location blocked — using Bengaluru centre"
            : "Using Bengaluru centre"}
          {accuracyMeters ? (
            <span className="text-xs font-normal text-emerald-700/70">(±{Math.round(accuracyMeters)} m)</span>
          ) : null}
        </span>
        <span className="flex items-center gap-3 text-xs text-emerald-800/70">
          {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          {isFallback && status !== "prompting" && (
            <button
              onClick={() => request()}
              className="inline-flex min-h-[36px] items-center rounded-full border border-emerald-300 bg-white px-3.5 py-1.5 font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
            >
              Use my location
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 font-semibold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </button>
        </span>
      </section>

      {loading && !plan && (
        <div className="grid h-64 place-items-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]">
          <SaaferaLoader label="Mapping the best places for your budget…" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">{error}</div>
      )}

      {plan && (
        <>
          <section className="animate-pop overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {/* Summary total — bold Play-Store gradient hero */}
            <div className="relative overflow-hidden bg-emerald-600 p-5 shadow-lg shadow-emerald-500/20 sm:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_90%_-10%,rgba(255,255,255,0.3),transparent_55%)]" />
              <span aria-hidden className="sheen-overlay animate-sheen" />
              <div className="relative flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-white/85">
                    <Wallet className="h-4 w-4" /> Total trip cost
                  </p>
                  <p className="mt-1 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                    {formatINR(plan.totals.cost)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white/85">
                    {formatINR(plan.totals.perPersonCost)} per person
                  </p>
                </div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  {formatINR(plan.totals.unspentBudget)} unspent
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <Stat icon={<MapPin className="h-4 w-4" />} label="Stops" value={plan.stops.length.toString()} sub={`from ${plan.candidatesConsidered} nearby`} />
                <Stat icon={<Navigation className="h-4 w-4" />} label="Distance" value={formatKm(plan.totals.distanceKm)} sub="round trip" />
                <Stat icon={<Clock className="h-4 w-4" />} label="Driving" value={formatMinutes(plan.totals.durationMinutes)} sub="excl. visits" />
              </div>

              {/* Cost breakdown — gradient bars proportional to total */}
              {(() => {
                const stay = plan.totals.stayTotal ?? 0;
                const total = Math.max(1, plan.totals.fuelTotal + plan.totals.entryFeesTotal + plan.totals.foodTotal + stay);
                const rows = [
                  { label: plan.travelLabel || "Travel", value: plan.totals.fuelTotal, bar: "bg-gradient-to-r from-emerald-400 to-emerald-600" },
                  { label: "Entry fees", value: plan.totals.entryFeesTotal, bar: "bg-gradient-to-r from-sky-400 to-sky-600" },
                  { label: "Food", value: plan.totals.foodTotal, bar: "bg-gradient-to-r from-amber-400 to-amber-600" },
                  ...(stay > 0
                    ? [{ label: `Stay · ${plan.totals.stayNights}N × ₹${plan.totals.stayNightly}`, value: stay, bar: "bg-gradient-to-r from-violet-400 to-violet-600" }]
                    : []),
                ];
                return (
                  <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                    {rows.map((r) => (
                      <div key={r.label}>
                        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span>{r.label}</span>
                          <span className="font-bold text-slate-900">{formatINR(r.value)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${r.bar} transition-all`}
                            style={{ width: `${Math.round((r.value / total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                Unspent: {formatINR(plan.totals.unspentBudget)} budget · {formatMinutes(plan.totals.unspentMinutes)} time.
                Costs are approximate estimates — actual fares & prices may vary.
              </p>
            </div>
          </section>

          {/* Train guidance — board / alight stations */}
          {plan.trainInfo && (plan.trainInfo.board || plan.trainInfo.dest) && (
            <Reveal as="section" className="card-hover overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/30">
                  <TrainFront className="h-4 w-4" />
                </span>
                Your train journey
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <StationCard title="Board from" station={plan.trainInfo.board} tone="emerald" />
                <StationCard title="Reach / alight at" station={plan.trainInfo.dest} tone="rose" />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Head to your boarding station, then reach the destination station and continue to the stops below.
              </p>
            </Reveal>
          )}

          {/* Primary CTA — navigate the whole trip in Google Maps */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl bg-emerald-600 p-5 text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.01] active:scale-[0.99]"
          >
            <span aria-hidden className="sheen-overlay animate-sheen" />
            <span className="relative flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur">
                <Navigation className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-base font-extrabold tracking-tight">Open this trip in Google Maps</span>
                <span className="block text-xs font-medium text-white/85">
                  Turn-by-turn navigation through all {plan.stops.length} stops and back
                </span>
              </span>
            </span>
            <ExternalLink className="relative h-5 w-5 shrink-0" />
          </a>

          {stopMarkers.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Your route</h2>
                <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
                  <button
                    onClick={sharePlan}
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                  >
                    {shared ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 text-emerald-600" /> Share
                      </>
                    )}
                  </button>
                  <button
                    onClick={saveTrip}
                    className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                      saved
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {saved ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 text-emerald-600" /> Saved
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4 text-emerald-600" /> Save trip
                      </>
                    )}
                  </button>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                  >
                    <Navigation className="h-4 w-4 text-emerald-600" /> Open in Google Maps
                  </a>
                  <button
                    onClick={() => {
                      sessionStorage.setItem(
                        PLAN_STORAGE_KEY,
                        JSON.stringify({
                          start,
                          stops: plan.stops.map((s) => ({
                            id: s.id,
                            name: s.name,
                            category: s.category,
                            lat: s.lat,
                            lng: s.lng,
                            idealMinutes: s.idealMinutes,
                          })),
                          geometry: plan.geometry,
                          savedAt: Date.now(),
                        })
                      );
                      router.push("/multi-stop/live");
                    }}
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95"
                  >
                    <Play className="h-4 w-4 fill-current" /> Start live tracking
                  </button>
                </div>
              </div>
              {/* Map-mode pager — flip the SAME route between road / bike / rail views */}
              <div className="mb-3 -mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
                {getMapModes(mode).map((m) => {
                  const Icon = m.icon;
                  const on = mapMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMapMode(m.id)}
                      aria-pressed={on}
                      className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                        on
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {m.label}
                    </button>
                  );
                })}
              </div>
              {mapMode === "train" && !hasTrainRoute ? (
                <div className="grid h-[300px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                  <div className="max-w-sm">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-200 text-slate-500">
                      <TrainFront className="h-6 w-6" />
                    </span>
                    <p className="mt-3 text-sm font-extrabold text-slate-800">No train route in this plan</p>
                    <p className="mt-1 text-xs text-slate-500">
                      No railway station was found near your start or destination, so this trip can&apos;t
                      be done by train. Try the Road view, or pick Car / Bus / Bike.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <TripMap
                    origin={start}
                    stops={stopMarkers}
                    route={mapMode === "road" || mapMode === "bike" ? plan.geometry ?? undefined : undefined}
                    mode={mapMode}
                    height={440}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Green pin is your location. Numbered pins are stops in optimal order — nearest first.{" "}
                    {mapMode === "train"
                      ? "The rail line links your stops in sequence."
                      : mapMode === "bike"
                      ? "The line follows real roads (OSRM) — the same route your bike takes."
                      : "The line follows real driving roads (OSRM)."}
                  </p>
                </>
              )}
            </section>
          )}

          <section className="space-y-5">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
              Day plan{days > 1 ? ` · split across ${days} days` : ""}
            </h2>
            {(() => {
              let running = 0; // global stop counter across days
              return dayBuckets.map((bucket, d) => {
                if (bucket.length === 0) return null;
                const dayMinutes = bucket.reduce(
                  (m, s) => m + s.arrivalMinutesFromPrev + s.idealMinutes,
                  0
                );
                const dayCost = bucket.reduce((c, s) => c + s.stopCost + s.travelCost, 0);
                return (
                <div key={d}>
                  {days > 1 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-500/30">
                        Day {d + 1}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {bucket.length} {bucket.length === 1 ? "stop" : "stops"} · {formatMinutes(dayMinutes)} · {formatINR(dayCost)}
                      </span>
                    </div>
                  )}
                  <ol className="space-y-0">
                    {d === 0 && bucket.length > 0 && (
                      <li className="flex items-center gap-4 pb-1">
                        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-slate-100 ring-4 ring-white">
                          <LocateFixed className="h-6 w-6 text-slate-500" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Your location</p>
                      </li>
                    )}
                    {d === 0 && bucket.length > 0 && (
                      <Connector
                        distanceKm={bucket[0].arrivalKmFromPrev}
                        minutes={bucket[0].arrivalMinutesFromPrev}
                      />
                    )}
                    {bucket.map((s, idx) => {
                      const i = running++;
                      return (
                <Fragment key={s.id}>
                <li>
                  <div className="flex items-start gap-4">
                    {/* Avatar node — sits on the connecting line, forming a journey path. */}
                    <div className="flex w-16 shrink-0 flex-col items-center">
                      <div className="relative h-16 w-16 overflow-hidden rounded-full ring-4 ring-white shadow-lg shadow-emerald-900/10">
                        <PlaceImage
                          name={s.name}
                          storedSrc={s.imageUrl}
                          category={s.category}
                          emoji={CATEGORY_EMOJI[s.category] ?? "📍"}
                          gradient={CATEGORY_TILE_GRADIENT[s.category] ?? "from-emerald-400 to-teal-600"}
                          className="absolute inset-0 h-full w-full"
                          emojiClassName="text-2xl"
                        />
                      </div>
                      <span className="-mt-3 grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white shadow-md shadow-emerald-500/30 ring-2 ring-white">
                        {i + 1}
                      </span>
                    </div>

                    <div className="card-hover min-w-0 flex-1 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Stop {i + 1}</p>
                          <h3 className="truncate font-extrabold tracking-tight text-slate-900">{s.name}</h3>
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">{s.category}</p>
                        </div>
                        <div className="text-right text-xs text-slate-600">
                          <p className="font-bold text-emerald-700">
                            {formatKm(haversineKm(coords, { lat: s.lat, lng: s.lng }))} from you
                          </p>
                          <p className="font-semibold text-slate-900">Stay {formatMinutes(s.idealMinutes)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {s.entryFee > 0 ? (
                          <Chip>
                            Entry {s.entryFeeKnown ? "" : "≈"}{formatINR(s.entryFee)} / person
                            {s.entryFeeKnown ? "" : " (est.)"}
                          </Chip>
                        ) : (
                          <Chip>Free entry</Chip>
                        )}
                        {s.stopCost > 0 && <Chip>Stop cost {formatINR(s.stopCost)}</Chip>}
                        {s.travelCost > 0 && <Chip>Fuel {formatINR(s.travelCost)}</Chip>}
                        {/* "Nearby Restaurants" — opens a live map of places to eat
                            right around this stop. Shown for every stop. */}
                        <a
                          href={`https://www.google.com/maps/search/restaurants/@${s.lat},${s.lng},15z`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[32px] items-center rounded-full bg-emerald-100 px-3 py-1.5 font-semibold text-emerald-800 transition hover:bg-emerald-200 active:scale-95"
                        >
                          Nearby Restaurants →
                        </a>
                        <a
                          href={placeMapUrl({ name: s.name, latitude: s.lat, longitude: s.lng })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[32px] items-center rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-200 active:scale-95"
                        >
                          Open in Maps →
                        </a>
                        {/* Already been here? Swap this place for another. */}
                        <button
                          type="button"
                          onClick={() => {
                            setSwapError(null);
                            setSwapIndex(swapIndex === i ? null : i);
                          }}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 font-semibold text-amber-800 transition hover:bg-amber-200 active:scale-95"
                        >
                          <Repeat className="h-3 w-3" /> Visited? Replace
                        </button>
                      </div>

                      <StopImageGrid
                        name={s.name}
                        category={s.category}
                        images={s.images ?? []}
                        fallbackImageUrl={s.imageUrl}
                        emoji={CATEGORY_EMOJI[s.category] ?? "📍"}
                        gradient={CATEGORY_TILE_GRADIENT[s.category] ?? "from-emerald-400 to-teal-600"}
                      />

                      {swapIndex === i && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-amber-900">
                          Already visited <span className="font-bold">{s.name}</span>? Pick another place to put here:
                        </p>
                        <button
                          type="button"
                          onClick={() => setSwapIndex(null)}
                          className="shrink-0 text-amber-700 hover:text-amber-900"
                          aria-label="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {swapError && <p className="mb-2 text-xs text-rose-600">{swapError}</p>}
                      {(() => {
                        const alts = alternativesFor(s);
                        if (alts.length === 0)
                          return <p className="text-xs text-slate-500">No alternative places available nearby.</p>;
                        return (
                          <div className="max-h-56 space-y-1.5 overflow-auto">
                            {alts.slice(0, 12).map((alt) => (
                              <button
                                key={alt.id}
                                type="button"
                                disabled={rerouting}
                                onClick={() => replaceStop(i, alt)}
                                className="flex w-full items-center gap-2.5 rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-left transition hover:border-amber-400 disabled:opacity-60"
                              >
                                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                  <PlaceImage
                                    name={alt.name}
                                    storedSrc={alt.imageUrl}
                                    category={alt.category}
                                    emoji={CATEGORY_EMOJI[alt.category] ?? "📍"}
                                    gradient={CATEGORY_TILE_GRADIENT[alt.category] ?? "from-emerald-400 to-teal-600"}
                                    className="absolute inset-0 h-full w-full"
                                    emojiClassName="text-sm"
                                  />
                                </div>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold text-slate-900">{alt.name}</span>
                                  <span className="block truncate text-[10px] uppercase tracking-wide text-slate-400">
                                    {alt.category}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs text-slate-500">
                                  {formatKm(haversineKm(s, { lat: alt.lat, lng: alt.lng }))}
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                      {rerouting && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating your route…
                        </p>
                      )}
                    </div>
                  )}
                    </div>
                  </div>
                </li>
                {idx < bucket.length - 1 && (
                  <Connector
                    distanceKm={bucket[idx + 1].arrivalKmFromPrev}
                    minutes={bucket[idx + 1].arrivalMinutesFromPrev}
                  />
                )}
                </Fragment>
                      );
                    })}
                  </ol>

                  {/* Night stay — a real hotel to overnight at before the next day */}
                  {plan.staySuggestion && dayBuckets.slice(d + 1).some((b) => b.length > 0) && (
                    <div className="card-hover mt-3 flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/30">
                        <BedDouble className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
                          Night {d + 1} · stay over
                        </p>
                        <p className="truncate text-sm font-extrabold text-slate-900">{plan.staySuggestion.name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                          <MapPin className="h-3 w-3" /> {plan.staySuggestion.area ?? plan.staySuggestion.city}
                          {plan.staySuggestion.rating ? (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {plan.staySuggestion.rating}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{formatINR(plan.staySuggestion.pricePerNight)}<span className="text-xs font-medium text-slate-500">/night</span></p>
                        <a
                          href={plan.staySuggestion.bookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex min-h-[32px] items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1 text-xs font-bold text-white shadow-md shadow-emerald-500/30 transition hover:scale-[1.03] active:scale-95"
                        >
                          <BedDouble className="h-3.5 w-3.5" /> Book
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                );
              });
            })()}
          </section>
        </>
      )}
    </Reveal>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center sm:text-left">
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 sm:justify-start">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{children}</span>;
}

// The travel "edge" between two stops in the journey path — sits centred
// under the avatar column so the whole day reads as one connected route
// rather than a stack of unrelated cards.
function Connector({ distanceKm, minutes }: { distanceKm: number; minutes: number }) {
  return (
    <li className="flex flex-col items-center py-1.5" aria-hidden>
      <div className="h-5 w-0.5 bg-gradient-to-b from-emerald-300 to-emerald-200" />
      <span className="my-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 shadow-sm">
        <Car className="h-3 w-3" /> {formatKm(distanceKm)} · {formatMinutes(minutes)}
      </span>
      <ChevronDown className="h-4 w-4 animate-bounce text-emerald-300" />
      <div className="h-5 w-0.5 bg-gradient-to-b from-emerald-200 to-transparent" />
    </li>
  );
}

// The map's second view toggle matches whatever transport the trip actually
// uses — a Bike trip gets a genuine "Bike" view (same real routed roads a
// bike takes), a Train trip keeps "Train" (straight-line preview — no rail
// geometry available). Anything else (car and any legacy/other mode) just
// shows the one real "Road" view.
function getMapModes(
  tripMode: string | undefined
): { id: "road" | "bike" | "train"; label: string; icon: typeof Car }[] {
  if (tripMode === "bike") return [{ id: "road", label: "Road", icon: Car }, { id: "bike", label: "Bike", icon: Bike }];
  if (tripMode === "train") return [{ id: "road", label: "Road", icon: Car }, { id: "train", label: "Train", icon: TrainFront }];
  return [{ id: "road", label: "Road", icon: Car }];
}

function StationCard({
  title,
  station,
  tone,
}: {
  title: string;
  station: { name: string; km: number; lat: number; lng: number; halt: boolean } | null;
  tone: "emerald" | "rose";
}) {
  const dot = tone === "emerald" ? "bg-emerald-600" : "bg-slate-400";
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <span className={`h-2 w-2 rounded-full ${dot}`} /> {title}
      </p>
      {station ? (
        <>
          <p className="mt-1 truncate text-sm font-bold text-slate-900">
            {station.name}
            {station.halt && <span className="ml-1 text-[10px] font-medium text-slate-400">(halt)</span>}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span>{formatKm(station.km)} away</span>
            <a
              href={placeMapUrl({ name: station.name, latitude: station.lat, longitude: station.lng })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
            >
              <MapPin className="h-3 w-3" /> Map
            </a>
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-400">No station found nearby</p>
      )}
    </div>
  );
}
