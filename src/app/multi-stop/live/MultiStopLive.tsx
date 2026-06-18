"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock,
  Gauge,
  MapPin,
  Navigation,
  Pause,
  Play,
  Square,
  Sparkles,
} from "lucide-react";

import { useLocation } from "@/components/app/LocationContext";
import {
  addMinutes,
  formatClock,
  formatKm,
  formatMinutes,
  haversineKm,
  type LatLng,
} from "@/lib/geo";

const TripMap = dynamic(() => import("@/components/map/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-slate-900 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

// Shape stored in sessionStorage by MultiStopPlanner before navigating here.
interface StoredStop {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  idealMinutes: number;
}
interface StoredPlan {
  start: LatLng;
  stops: StoredStop[];
  geometry: [number, number][] | null;
  savedAt: number;
}

const STORAGE_KEY = "yatra-point/multi-stop-plan";
const ARRIVAL_RADIUS_M = 300;

type Phase = "ready" | "tracking" | "paused" | "completed";

export function MultiStopLive() {
  const { coords, status, startWatch, stopWatch, request, lastUpdate } = useLocation();
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [trail, setTrail] = useState<LatLng[]>([]);
  const [speedKmh, setSpeedKmh] = useState(0);
  const lastSample = useRef<{ at: number; pos: LatLng } | null>(null);

  // Load the plan from sessionStorage.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredPlan;
      if (parsed.stops?.length > 0) setPlan(parsed);
    } catch {
      // Ignore corrupted JSON.
    }
  }, []);

  // Compute next-stop index = the lowest index not yet visited.
  const nextIdx = useMemo(() => {
    if (!plan) return -1;
    for (let i = 0; i < plan.stops.length; i++) {
      if (!visited.has(i)) return i;
    }
    return -1; // all visited
  }, [plan, visited]);

  const nextStop = plan && nextIdx >= 0 ? plan.stops[nextIdx] : null;

  // Distance/ETA to next stop.
  const distanceRemainingKm = useMemo(() => {
    if (!nextStop) return 0;
    return haversineKm(coords, { lat: nextStop.lat, lng: nextStop.lng });
  }, [coords, nextStop]);

  const etaMinutes = useMemo(() => {
    if (!nextStop) return 0;
    if (speedKmh > 5) return (distanceRemainingKm / speedKmh) * 60;
    return (distanceRemainingKm / 25) * 60; // assume 25 km/h baseline urban
  }, [distanceRemainingKm, speedKmh, nextStop]);

  const distanceCoveredKm = useMemo(() => {
    let total = 0;
    for (let i = 1; i < trail.length; i++) {
      total += haversineKm(trail[i - 1], trail[i]);
    }
    return total;
  }, [trail]);

  // Auto-advance on arrival.
  useEffect(() => {
    if (phase !== "tracking" || !plan) return;

    // Append to trail (with min-distance gate to avoid GPS jitter).
    setTrail((prev) => {
      const last = prev[prev.length - 1];
      if (last && haversineKm(last, coords) < 0.005) return prev;
      return [...prev, coords];
    });

    // Speed smoothing.
    const now = Date.now();
    const prev = lastSample.current;
    if (prev && now > prev.at) {
      const km = haversineKm(prev.pos, coords);
      const hours = (now - prev.at) / 3_600_000;
      if (hours > 0) {
        const kmh = km / hours;
        if (kmh < 200) setSpeedKmh((s) => s * 0.4 + kmh * 0.6);
      }
    }
    lastSample.current = { at: now, pos: coords };

    // Arrival check.
    if (nextStop && distanceRemainingKm * 1000 < ARRIVAL_RADIUS_M) {
      const newVisited = new Set(visited);
      newVisited.add(nextIdx);
      setVisited(newVisited);
      if (newVisited.size === plan.stops.length) {
        setPhase("completed");
        stopWatch();
      }
    }
  }, [coords, phase, plan, nextStop, nextIdx, distanceRemainingKm, visited, stopWatch]);

  function start() {
    if (status !== "granted") request();
    startWatch();
    setPhase("tracking");
    setStartedAt(Date.now());
    setTrail([coords]);
    lastSample.current = null;
  }

  function pause() {
    stopWatch();
    setPhase("paused");
  }

  function resume() {
    startWatch();
    setPhase("tracking");
  }

  function stop() {
    stopWatch();
    setPhase("ready");
    setVisited(new Set());
    setTrail([]);
    setStartedAt(null);
    setSpeedKmh(0);
    lastSample.current = null;
  }

  function markVisited() {
    if (nextIdx < 0 || !plan) return;
    const newVisited = new Set(visited);
    newVisited.add(nextIdx);
    setVisited(newVisited);
    if (newVisited.size === plan.stops.length) {
      setPhase("completed");
      stopWatch();
    }
  }

  // Map stops with active highlight on the next one.
  const mapStops = useMemo(() => {
    if (!plan) return [];
    return plan.stops.map((s, i) => ({
      lat: s.lat,
      lng: s.lng,
      name: s.name,
      active: i === nextIdx,
    }));
  }, [plan, nextIdx]);

  // Elapsed since start.
  const elapsedMinutes = startedAt
    ? Math.max(0, (Date.now() - startedAt) / 60_000)
    : 0;
  const eta = useMemo(
    () => (nextStop ? addMinutes(new Date(), etaMinutes) : null),
    [nextStop, etaMinutes]
  );

  if (!plan) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl bg-slate-900 p-6 text-center">
        <p className="text-sm text-slate-300">
          No active trip plan. Build one first.
        </p>
        <Link
          href="/budget-planner"
          className="mt-4 inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          Go to planner
        </Link>
      </div>
    );
  }

  return (
    <div
      className="grid grid-rows-[1fr_auto] md:grid-rows-1 md:grid-cols-[1fr_24rem]"
      style={{ minHeight: "calc(100vh - 53px)" }}
    >
      {/* Map */}
      <div className="relative h-[50vh] md:h-[calc(100vh-53px)]">
        <TripMap
          origin={coords}
          stops={mapStops}
          route={plan.geometry ?? undefined}
          trail={trail}
        />
        {phase === "tracking" && (
          <div className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold text-white shadow-lg backdrop-blur">
            <span className="block h-2 w-2 animate-pulse rounded-full bg-white" />
            Live
          </div>
        )}
        {phase === "completed" && (
          <div className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-violet-500/90 px-3 py-1 text-xs font-bold text-white shadow-lg backdrop-blur">
            <Sparkles className="h-3 w-3" /> Trip complete
          </div>
        )}
      </div>

      {/* Telemetry */}
      <div className="flex flex-col gap-3 overflow-y-auto bg-slate-900 p-4 text-white">
        <header>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Multi-stop trip
          </p>
          <h2 className="text-lg font-bold">
            {visited.size} of {plan.stops.length} stops visited
          </h2>
          <div className="mt-2 h-1.5 rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${(visited.size / plan.stops.length) * 100}%`,
              }}
            />
          </div>
        </header>

        {nextStop ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-300">
              Stop {nextIdx + 1} · Heading to
            </p>
            <p className="font-semibold text-white">{nextStop.name}</p>
            <p className="text-xs text-emerald-200/80">{nextStop.category}</p>
            <button
              type="button"
              onClick={markVisited}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-emerald-300/40 bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
            >
              <Check className="h-3 w-3" /> I&apos;m here — mark visited
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-violet-400/40 bg-violet-500/10 p-3 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-violet-300" />
            <p className="mt-1 font-bold text-violet-100">All stops visited!</p>
            <p className="text-xs text-violet-200/70">
              Trip duration: {formatMinutes(elapsedMinutes)} ·{" "}
              {formatKm(distanceCoveredKm)} covered
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Stat
            icon={<Navigation className="h-4 w-4" />}
            label="To next"
            value={nextStop ? formatKm(distanceRemainingKm) : "—"}
          />
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label="ETA"
            value={eta ? formatClock(eta) : "—"}
            sub={nextStop ? `in ${formatMinutes(etaMinutes)}` : undefined}
          />
          <Stat
            icon={<Gauge className="h-4 w-4" />}
            label="Speed"
            value={`${Math.round(speedKmh)} km/h`}
            sub={phase === "tracking" ? "live" : "—"}
          />
          <Stat
            icon={<MapPin className="h-4 w-4" />}
            label="Covered"
            value={formatKm(distanceCoveredKm)}
            sub={
              startedAt
                ? `since ${formatClock(new Date(startedAt))}`
                : "not started"
            }
          />
        </div>

        {/* All stops list */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
            Itinerary
          </p>
          <ol className="space-y-1.5 text-sm">
            {plan.stops.map((s, i) => {
              const done = visited.has(i);
              const active = i === nextIdx;
              return (
                <li
                  key={s.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                    active
                      ? "bg-emerald-500/20 text-emerald-100"
                      : done
                      ? "text-slate-400 line-through"
                      : "text-slate-200"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-emerald-500 text-white"
                        : active
                        ? "bg-amber-500 text-white"
                        : "bg-white/10 text-slate-200"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="truncate">{s.name}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Live position
          </p>
          <p className="font-mono text-sm">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
          {lastUpdate && (
            <p className="text-xs text-slate-500">
              updated {formatClock(new Date(lastUpdate))}
            </p>
          )}
          {status !== "granted" && (
            <button
              type="button"
              onClick={request}
              className="mt-2 w-full rounded-lg border border-amber-400/40 bg-amber-400/10 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20"
            >
              Grant location permission
            </button>
          )}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          {phase === "ready" && (
            <button
              type="button"
              onClick={start}
              disabled={status === "denied"}
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-bold shadow-lg shadow-emerald-500/30 transition hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" /> Start trip
            </button>
          )}
          {phase === "tracking" && (
            <>
              <button
                type="button"
                onClick={pause}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-bold text-white transition hover:bg-white/20"
              >
                <Pause className="h-4 w-4" /> Pause
              </button>
              <button
                type="button"
                onClick={stop}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 text-sm font-bold text-white transition hover:bg-rose-600"
              >
                <Square className="h-4 w-4 fill-current" /> End
              </button>
            </>
          )}
          {phase === "paused" && (
            <>
              <button
                type="button"
                onClick={resume}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
              >
                <Play className="h-4 w-4 fill-current" /> Resume
              </button>
              <button
                type="button"
                onClick={stop}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 text-sm font-bold text-white transition hover:bg-rose-600"
              >
                <Square className="h-4 w-4 fill-current" /> End
              </button>
            </>
          )}
          {phase === "completed" && (
            <Link
              href="/budget-planner"
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 text-sm font-bold text-white hover:bg-violet-600"
            >
              Plan another trip
            </Link>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-500">
          Auto-advances when you&apos;re within {ARRIVAL_RADIUS_M} m of a stop.
        </p>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
