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
  Sparkles,
} from "lucide-react";

import { useLocation } from "@/components/app/LocationContext";
import { formatINR } from "@/lib/format";
import { formatKm, formatMinutes } from "@/lib/geo";
import { VEHICLES, type VehicleKind } from "@/lib/budget";

const TripMap = dynamic(() => import("@/components/map/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

// User-facing category groups. Each maps to one or more Overpass categories.
interface CategoryGroup {
  slug: string;
  label: string;
  emoji: string;
  overpass: string[];
}

export const GROUPS: CategoryGroup[] = [
  { slug: "temples", label: "Temples", emoji: "🛕", overpass: ["temple", "place_of_worship"] },
  { slug: "churches", label: "Churches", emoji: "⛪", overpass: ["church"] },
  { slug: "museums", label: "Museums", emoji: "🏛️", overpass: ["museum"] },
  { slug: "parks", label: "Parks", emoji: "🌳", overpass: ["park", "garden"] },
  { slug: "lakes", label: "Lakes", emoji: "💧", overpass: ["lake"] },
  { slug: "viewpoints", label: "Viewpoints", emoji: "🌄", overpass: ["viewpoint"] },
  { slug: "heritage", label: "Heritage", emoji: "🏯", overpass: ["monument", "fort", "tourist_attraction"] },
  { slug: "malls", label: "Malls", emoji: "🛍️", overpass: ["mall", "marketplace"] },
  { slug: "restaurants", label: "Restaurants", emoji: "🍽️", overpass: ["restaurant"] },
  { slug: "cafes", label: "Cafés", emoji: "☕", overpass: ["cafe"] },
  { slug: "nightlife", label: "Nightlife", emoji: "🍻", overpass: ["nightlife"] },
  { slug: "cinema", label: "Cinema", emoji: "🎬", overpass: ["cinema", "theatre"] },
  { slug: "amusement", label: "Amusement", emoji: "🎢", overpass: ["amusement", "zoo"] },
];

interface PlanStop {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  entryFee: number;
  idealMinutes: number;
  stopCost: number;
  travelCost: number;
  arrivalKmFromPrev: number;
  arrivalMinutesFromPrev: number;
  meta?: { osmId?: string; citySeedSlug?: string };
}

interface PlanResponse {
  ok: boolean;
  error?: string;
  stops: PlanStop[];
  totals: {
    distanceKm: number;
    durationMinutes: number;
    cost: number;
    perPersonCost: number;
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

export interface LivePlanProps {
  initialBudget: number;
  initialPeople: number;
  initialHours: number;
  initialVehicle: VehicleKind;
  initialGroups: string[];
  initialIncludeFood: boolean;
  initialStops: number;
}

export function LivePlan({
  initialBudget,
  initialPeople,
  initialHours,
  initialVehicle,
  initialGroups,
  initialIncludeFood,
  initialStops,
}: LivePlanProps) {
  const router = useRouter();
  const { coords, status, accuracyMeters, isFallback, request } = useLocation();

  // Full, editable planner inputs — the same set the mixed-category planner exposes.
  const [budget, setBudget] = useState(initialBudget);
  const [hours, setHours] = useState(initialHours);
  const [people, setPeople] = useState(initialPeople);
  const [maxStops, setMaxStops] = useState(initialStops);
  const [radiusKm, setRadiusKm] = useState(25);
  const [vehicle, setVehicle] = useState<VehicleKind>(initialVehicle);
  const [includeFood, setIncludeFood] = useState(initialIncludeFood);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    new Set(initialGroups.length ? initialGroups : ["temples", "heritage", "restaurants"])
  );

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const didAutoRun = useRef(false);

  const overpassCategories = useMemo(() => {
    const out = new Set<string>();
    for (const g of GROUPS) {
      if (selectedGroups.has(g.slug)) for (const o of g.overpass) out.add(o);
    }
    return [...out];
  }, [selectedGroups]);

  function toggleGroup(slug: string) {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const generate = useCallback(async () => {
    if (overpassCategories.length === 0) {
      setError("Pick at least one category.");
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
          totalBudget: budget,
          hours,
          people,
          vehicle,
          categories: overpassCategories,
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
  }, [
    coords.lat,
    coords.lng,
    budget,
    hours,
    people,
    vehicle,
    overpassCategories,
    includeFood,
    maxStops,
    radiusKm,
  ]);

  // Ask for live location on mount.
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

  return (
    <div id="live-plan" className="mt-8 space-y-5 scroll-mt-20">
      {/* Live location banner */}
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-emerald-900">
          <LocateFixed className={`h-5 w-5 ${isFallback ? "text-amber-500" : "text-emerald-600"}`} />
          {status === "granted"
            ? "Using your live location"
            : status === "prompting"
            ? "Getting your location…"
            : status === "denied"
            ? "Location blocked — using Bengaluru centre"
            : "Using Bengaluru centre"}
          {accuracyMeters ? (
            <span className="text-xs font-normal text-emerald-700/70">
              (±{Math.round(accuracyMeters)} m)
            </span>
          ) : null}
        </span>
        <span className="text-xs text-emerald-800/70">
          {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          {isFallback && status !== "prompting" && (
            <button
              onClick={() => request()}
              className="ml-3 rounded-full border border-emerald-300 px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Use my location
            </button>
          )}
        </span>
      </section>

      {/* Build the trip — full control set */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <h2 className="text-lg font-bold text-slate-900">Fine-tune your trip</h2>
        <p className="text-xs text-slate-500">
          Pre-filled from your preferences — adjust anything and regenerate.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <NumberField label="Budget (₹)" min={500} step={500} value={budget} onChange={setBudget} />
          <NumberField label="Hours" min={1} max={18} value={hours} onChange={setHours} />
          <NumberField label="People" min={1} max={20} value={people} onChange={setPeople} />
          <NumberField label="Max stops" min={2} max={10} value={maxStops} onChange={setMaxStops} />
          <NumberField label="Search radius (km)" min={2} max={80} value={radiusKm} onChange={setRadiusKm} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Vehicle</p>
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(VEHICLES) as VehicleKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setVehicle(k)}
                  title={`${VEHICLES[k].label} · ₹${VEHICLES[k].costPerKm}/km`}
                  className={`rounded-lg border px-2 py-1.5 text-lg transition ${
                    vehicle === k
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {VEHICLES[k].emoji}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-end gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeFood}
              onChange={(e) => setIncludeFood(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Include one food stop (restaurant / café)
          </label>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Categories — pick any combination
          </p>
          <div className="flex flex-wrap gap-2">
            {GROUPS.map((g) => {
              const on = selectedGroups.has(g.slug);
              return (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => toggleGroup(g.slug)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{g.emoji}</span>
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={loading || status === "prompting"}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Planning…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate trip
              </>
            )}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </section>

      {loading && !plan && (
        <div className="grid h-40 place-items-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding the nearest places around you…
          </span>
        </div>
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
            <p className="mt-3 text-xs text-emerald-900/70">
              Unspent: {formatINR(plan.totals.unspentBudget)} budget ·{" "}
              {formatMinutes(plan.totals.unspentMinutes)} time · Live OSM ·{" "}
              {plan.overpassPlaces} OSM places, {plan.seedPlaces} curated.
              {plan.overpassError && (
                <span className="ml-1 text-amber-700">(Overpass error, used curated picks only)</span>
              )}
            </p>
          </section>

          {stopMarkers.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">Your route</h2>
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
              <TripMap origin={coords} stops={stopMarkers} route={plan.geometry ?? undefined} height={440} />
              <p className="mt-2 text-xs text-slate-500">
                Green pin is your location. Numbered pins are stops in optimal order — nearest first.
                The line follows real driving roads (OSRM).
              </p>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">Day plan</h2>
            <ol className="relative space-y-3 border-l-2 border-emerald-100 pl-5">
              {plan.stops.map((s, i) => (
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
                      <p>
                        {formatKm(s.arrivalKmFromPrev)} · {formatMinutes(s.arrivalMinutesFromPrev)} from{" "}
                        {i === 0 ? "start" : "previous"}
                      </p>
                      <p className="font-semibold text-slate-900">Stay {formatMinutes(s.idealMinutes)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {s.entryFee > 0 && <Chip>Entry {formatINR(s.entryFee)} / person</Chip>}
                    {s.stopCost > 0 && <Chip>Stop cost {formatINR(s.stopCost)}</Chip>}
                    {s.travelCost > 0 && <Chip>Fuel {formatINR(s.travelCost)}</Chip>}
                    {s.meta?.citySeedSlug && (
                      <a
                        href={`/explore-bangalore/${s.meta.citySeedSlug}`}
                        className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800 hover:bg-emerald-200"
                      >
                        Details →
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 hover:bg-slate-200"
                    >
                      Open in Maps →
                    </a>
                  </div>
                </li>
              ))}
            </ol>
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

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
      />
    </label>
  );
}
