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
  Minus,
  Plus,
} from "lucide-react";

import { useLocation } from "@/components/app/LocationContext";
import { formatINR } from "@/lib/format";
import { formatKm, formatMinutes } from "@/lib/geo";
import type { VehicleKind } from "@/lib/budget";

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
  budget: number;
  people: number;
  hours: number;
  vehicle: VehicleKind;
  categories: string[];
  includeFood: boolean;
  initialStops: number;
}

export function LivePlan({
  budget,
  people,
  hours,
  vehicle,
  categories,
  includeFood,
  initialStops,
}: LivePlanProps) {
  const router = useRouter();
  const { coords, status, isFallback, request } = useLocation();

  const [maxStops, setMaxStops] = useState(initialStops);
  const [radiusKm, setRadiusKm] = useState(25);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastKey = useRef<string>("");

  const generate = useCallback(
    async (stops: number, radius: number) => {
      if (categories.length === 0) {
        setError("Pick at least one trip type.");
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
            categories,
            includeFood,
            maxStops: stops,
            searchRadiusKm: radius,
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
    },
    [coords.lat, coords.lng, budget, hours, people, vehicle, categories, includeFood]
  );

  // Ask for live location on mount.
  useEffect(() => {
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate whenever the start coordinates settle (once per location).
  useEffect(() => {
    const key = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    generate(maxStops, radiusKm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.lat, coords.lng]);

  const stopMarkers = useMemo(
    () => plan?.stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name })) ?? [],
    [plan?.stops]
  );

  return (
    <div id="live-plan" className="mt-8 space-y-5 scroll-mt-20">
      {/* Location + stops controls */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <LocateFixed className={`h-5 w-5 ${isFallback ? "text-amber-500" : "text-emerald-600"}`} />
            <span className="font-medium text-slate-700">
              {status === "granted"
                ? "Planning from your live location"
                : status === "prompting"
                ? "Getting your location…"
                : status === "denied"
                ? "Location blocked — using Bengaluru centre"
                : "Using Bengaluru centre"}
            </span>
            {isFallback && status !== "prompting" && (
              <button
                onClick={() => request()}
                className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Use my location
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Stops</span>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
                <button
                  onClick={() => setMaxStops((s) => Math.max(2, s - 1))}
                  className="grid h-7 w-7 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
                  aria-label="Fewer stops"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-slate-900">{maxStops}</span>
                <button
                  onClick={() => setMaxStops((s) => Math.min(10, s + 1))}
                  className="grid h-7 w-7 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
                  aria-label="More stops"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <button
              onClick={() => generate(maxStops, radiusKm)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? "Generating…" : "Generate plan"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Search radius</span>
          <input
            type="range"
            min={5}
            max={80}
            step={5}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="flex-1 accent-emerald-600"
          />
          <span className="w-12 text-sm font-semibold text-slate-700">{radiusKm} km</span>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
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
          <section className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<MapPin className="h-4 w-4" />} label="Stops" value={plan.stops.length.toString()} sub={`from ${plan.candidatesConsidered} nearby`} />
            <Stat icon={<Navigation className="h-4 w-4" />} label="Distance" value={formatKm(plan.totals.distanceKm)} sub="round trip" />
            <Stat icon={<Clock className="h-4 w-4" />} label="Driving" value={formatMinutes(plan.totals.durationMinutes)} sub="excl. visits" />
            <Stat icon={<Wallet className="h-4 w-4" />} label="Total cost" value={formatINR(plan.totals.cost)} sub={`${formatINR(plan.totals.perPersonCost)} / person`} />
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
                The line follows real driving roads.
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
                    {s.travelCost > 0 && <Chip>Fuel {formatINR(s.travelCost)}</Chip>}
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
