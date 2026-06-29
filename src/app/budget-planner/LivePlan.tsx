"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";

import { useLocation } from "@/components/app/LocationContext";
import { formatINR } from "@/lib/format";
import { formatKm, formatMinutes, haversineKm } from "@/lib/geo";
import { VEHICLES, type VehicleKind } from "@/lib/budget";
import { groupsToOverpass } from "@/lib/catalog/place-groups";

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
  meta?: { osmId?: string; citySeedSlug?: string };
}

interface PlanResponse {
  ok: boolean;
  error?: string;
  stops: PlanStop[];
  alternatives?: Alternative[];
  totals: {
    distanceKm: number;
    durationMinutes: number;
    cost: number;
    perPersonCost: number;
    fuelTotal: number;
    entryFeesTotal: number;
    foodTotal: number;
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

export interface LivePlanProps {
  budget: number;
  people: number;
  hours: number;
  vehicle: VehicleKind;
  groups: string[];
  includeFood: boolean;
  maxStops: number;
  radiusKm?: number;
  days?: number;
  // When planning a chosen area (state / district / taluk) instead of "around
  // me", these override the live GPS origin and add hand-picked catalogue stops.
  originOverride?: { lat: number; lng: number; label?: string } | null;
  placeIds?: string[];
}

export function LivePlan({
  budget,
  people,
  hours,
  vehicle,
  groups,
  includeFood,
  maxStops,
  radiusKm = 25,
  days = 1,
  originOverride = null,
  placeIds = [],
}: LivePlanProps) {
  const router = useRouter();
  const live = useLocation();

  // The route ALWAYS starts from the traveller's live location (the green pin).
  // In area mode, the chosen area's centre is used only to DISCOVER places —
  // never as the start — so the trip always begins where the user actually is.
  const coords = live.coords;
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
  const didAutoRun = useRef(false);

  // "Already visited / replace this place" — which stop's swap panel is open,
  // and whether a re-route is in flight.
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  const overpassCategories = useMemo(() => groupsToOverpass(groups), [groups]);

  // Signature of the inputs — lets us restore a cached plan only when it still
  // matches the current selections.
  const sig = useMemo(
    () => JSON.stringify({ budget, people, hours, vehicle, groups, includeFood, maxStops, radiusKm, days, originOverride, placeIds }),
    [budget, people, hours, vehicle, groups, includeFood, maxStops, radiusKm, days, originOverride, placeIds]
  );

  const generate = useCallback(async () => {
    if (overpassCategories.length === 0 && placeIds.length === 0) {
      setError("Pick at least one place type, or choose specific places above.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/multi-stop/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { lat: coords.lat, lng: coords.lng },
          searchCentre,
          totalBudget: budget,
          hours,
          people,
          vehicle,
          categories: overpassCategories,
          includePlaceIds: placeIds,
          includeFood,
          maxStops,
          searchRadiusKm: radiusKm,
        }),
      });
      const data: PlanResponse = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not generate a plan.");
        setPlan(null);
        return;
      }
      setPlan(data);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }, [coords.lat, coords.lng, searchCentre.lat, searchCentre.lng, budget, hours, people, vehicle, overpassCategories, placeIds, includeFood, maxStops, radiusKm]);

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

  // Split the stops across the chosen days by TIME, not by an even count — so
  // each day holds roughly a full day's worth of visiting + driving and the
  // whole trip is realistically coverable in the days selected.
  const dayBuckets = useMemo(() => {
    if (!plan) return [] as PlanStop[][];
    const nDays = Math.max(1, days);
    // Target minutes per day (visit + travel). Floor keeps short trips from
    // spilling one stop per day.
    const cap = Math.max(240, (hours / nDays) * 60);
    const buckets: PlanStop[][] = [[]];
    let acc = 0;
    for (const s of plan.stops) {
      const t = s.arrivalMinutesFromPrev + s.idealMinutes;
      const cur = buckets[buckets.length - 1];
      if (buckets.length < nDays && cur.length > 0 && acc + t > cap) {
        buckets.push([]);
        acc = 0;
      }
      buckets[buckets.length - 1].push(s);
      acc += t;
    }
    return buckets;
  }, [plan, days, hours]);

  // Same route, opened in Google Maps: start → each stop in order → back to start.
  const googleMapsUrl = useMemo(() => {
    if (!plan || plan.stops.length === 0) return "#";
    const origin = `${coords.lat},${coords.lng}`;
    const params = new URLSearchParams({
      api: "1",
      origin,
      destination: origin,
      travelmode: "driving",
    });
    const waypoints = plan.stops.map((s) => `${s.lat},${s.lng}`).join("|");
    if (waypoints) params.set("waypoints", waypoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [plan, coords.lat, coords.lng]);

  // Share the plan to any platform (WhatsApp / Instagram / etc.) via the native
  // share sheet, including the Google Maps route link. Falls back to copying.
  async function sharePlan() {
    if (!plan) return;
    const lines = plan.stops.map((s, i) => `${i + 1}. ${s.name}`).join("\n");
    const text =
      `🗺️ My trip plan — ${plan.stops.length} stops\n${lines}\n\n` +
      `📍 ${formatKm(plan.totals.distanceKm)} · 💰 ${formatINR(plan.totals.cost)} total\n\n` +
      `Open the full route in Google Maps:\n${googleMapsUrl}\n\n— Planned with Explore World`;
    const shareData = { title: "My Trip Plan", text, url: googleMapsUrl };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      return; // user dismissed the share sheet
    }
    // Desktop fallback — copy to clipboard.
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
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
      meta: alt.meta,
    };
    const draftStops = plan.stops.map((s, i) => (i === index ? newStop : s));

    try {
      const res = await fetch("/api/multi-stop/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { lat: coords.lat, lng: coords.lng },
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
    <div id="live-plan" className="mt-8 space-y-5 scroll-mt-20">
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
              className="rounded-full border border-emerald-300 px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Use my location
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </button>
        </span>
      </section>

      {loading && !plan && (
        <div className="grid h-40 place-items-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding the nearest places around you…
          </span>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>
      )}

      {plan && (
        <>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={<MapPin className="h-4 w-4" />} label="Stops" value={plan.stops.length.toString()} sub={`from ${plan.candidatesConsidered} nearby`} />
              <Stat icon={<Navigation className="h-4 w-4" />} label="Distance" value={formatKm(plan.totals.distanceKm)} sub="round trip via OSRM" />
              <Stat icon={<Clock className="h-4 w-4" />} label="Driving time" value={formatMinutes(plan.totals.durationMinutes)} sub="excluding visits" />
              <Stat icon={<Wallet className="h-4 w-4" />} label="Total cost" value={formatINR(plan.totals.cost)} sub={`${formatINR(plan.totals.perPersonCost)} per person`} />
            </div>
            {/* Cost breakdown — fuel + entry fees + food */}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-emerald-200 pt-3">
              <CostChip label="Fuel" value={formatINR(plan.totals.fuelTotal)} />
              <CostChip label="Entry fees" value={formatINR(plan.totals.entryFeesTotal)} />
              <CostChip label="Food" value={formatINR(plan.totals.foodTotal)} />
            </div>
            <p className="mt-3 text-xs text-emerald-900/70">
              Unspent: {formatINR(plan.totals.unspentBudget)} budget · {formatMinutes(plan.totals.unspentMinutes)} time ·
              Live OSM · {plan.overpassPlaces} OSM places, {plan.seedPlaces} curated.
              {plan.overpassError && <span className="ml-1 text-amber-700">(Overpass error, used curated picks only)</span>}
            </p>
          </section>

          {/* Primary CTA — navigate the whole trip in Google Maps */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 p-5 text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20">
                <Navigation className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-base font-bold">Open this trip in Google Maps</span>
                <span className="block text-xs text-white/85">
                  Turn-by-turn navigation through all {plan.stops.length} stops and back
                </span>
              </span>
            </span>
            <ExternalLink className="h-5 w-5 shrink-0" />
          </a>

          {stopMarkers.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">Your route</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={sharePlan}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
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
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Navigation className="h-4 w-4 text-emerald-600" /> Open in Google Maps
                  </a>
                  <button
                    onClick={() => {
                      sessionStorage.setItem(
                        PLAN_STORAGE_KEY,
                        JSON.stringify({
                          start: coords,
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
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    <Play className="h-4 w-4 fill-current" /> Start live tracking
                  </button>
                </div>
              </div>
              <TripMap origin={coords} stops={stopMarkers} route={plan.geometry ?? undefined} height={440} />
              <p className="mt-2 text-xs text-slate-500">
                Green pin is your location. Numbered pins are stops in optimal order — nearest first.
                The line follows real driving roads (OSRM).
              </p>
            </section>
          )}

          <section className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900">
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
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                        Day {d + 1}
                      </span>
                      <span className="text-xs text-slate-500">
                        {bucket.length} {bucket.length === 1 ? "stop" : "stops"} · {formatMinutes(dayMinutes)} · {formatINR(dayCost)}
                      </span>
                    </div>
                  )}
                  <ol className="relative space-y-3 border-l-2 border-emerald-100 pl-5">
                    {bucket.map((s) => {
                      const i = running++;
                      return (
                <li key={s.id} className="relative rounded-xl border border-slate-200 bg-white p-4">
                  <span className="absolute -left-[27px] top-4 grid h-4 w-4 place-items-center rounded-full bg-white">
                    <span className="block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                  </span>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500">Stop {i + 1}</p>
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <p className="text-xs uppercase tracking-wide text-slate-400">{s.category}</p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <p className="font-semibold text-emerald-700">
                        {formatKm(haversineKm(coords, { lat: s.lat, lng: s.lng }))} from you
                      </p>
                      <p>
                        {formatKm(s.arrivalKmFromPrev)} · {formatMinutes(s.arrivalMinutesFromPrev)} from{" "}
                        {i === 0 ? "start" : "previous stop"}
                      </p>
                      <p className="font-semibold text-slate-900">Stay {formatMinutes(s.idealMinutes)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {s.entryFeeKnown ? (
                      s.entryFee > 0 ? (
                        <Chip>Entry {formatINR(s.entryFee)} / person</Chip>
                      ) : (
                        <Chip>Free entry</Chip>
                      )
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-400">
                        Entry fee not listed
                      </span>
                    )}
                    {s.stopCost > 0 && <Chip>Stop cost {formatINR(s.stopCost)}</Chip>}
                    {s.travelCost > 0 && <Chip>Fuel {formatINR(s.travelCost)}</Chip>}
                    {/* "Nearby Restaurants" — opens a live map of places to eat
                        right around this stop. Shown for every stop. */}
                    <a
                      href={`https://www.google.com/maps/search/restaurants/@${s.lat},${s.lng},15z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800 hover:bg-emerald-200"
                    >
                      Nearby Restaurants →
                    </a>
                    <a
                      href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 hover:bg-slate-200"
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
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800 transition hover:bg-amber-200"
                    >
                      <Repeat className="h-3 w-3" /> Visited? Replace
                    </button>
                  </div>

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
                                className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-left transition hover:border-amber-400 disabled:opacity-60"
                              >
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-600" />
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
                </li>
                      );
                    })}
                  </ol>
                </div>
                );
              });
            })()}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-emerald-800/70">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold text-emerald-900">{value}</p>
      {sub && <p className="text-[11px] text-emerald-800/70">{sub}</p>}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{children}</span>;
}

function CostChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200">
      <span className="text-emerald-700/70">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}
