"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clock,
  Gauge,
  MapPin,
  Navigation,
  Pause,
  Play,
  Sparkles,
  Square,
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
import { fetchDrivingRoute, type RouteResult } from "@/lib/routing";
import type { NearbyDestination } from "@/lib/db/schema";

const TripMap = dynamic(() => import("@/components/map/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-slate-900 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

interface LiveTrackerProps {
  trip: NearbyDestination;
}

type Phase = "ready" | "tracking" | "paused" | "arrived";

export function LiveTracker({ trip }: LiveTrackerProps) {
  const { coords, status, startWatch, stopWatch, watching, lastUpdate, request } =
    useLocation();

  const destination = useMemo<LatLng>(
    () => ({ lat: Number(trip.latitude), lng: Number(trip.longitude) }),
    [trip.latitude, trip.longitude]
  );

  const [phase, setPhase] = useState<Phase>("ready");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [trail, setTrail] = useState<LatLng[]>([]);
  const [route, setRoute] = useState<RouteResult | null>(null);

  // Last-known speed via two consecutive samples (m/s → km/h).
  const lastSample = useRef<{ at: number; at_pos: LatLng } | null>(null);
  const [speedKmh, setSpeedKmh] = useState(0);

  // Fetch route once on mount.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchDrivingRoute(coords, destination, ctrl.signal).then((r) => setRoute(r));
    return () => ctrl.abort();
    // We intentionally only fetch on mount — re-fetching during tracking
    // would burn API calls. ETA recalculates from the live speed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Append to trail whenever coords change AND we're tracking.
  useEffect(() => {
    if (phase !== "tracking") return;
    setTrail((prev) => {
      // Skip if essentially the same point (< 5 m away).
      const last = prev[prev.length - 1];
      if (last && haversineKm(last, coords) < 0.005) return prev;
      return [...prev, coords];
    });

    // Speed calc
    const now = Date.now();
    const prev = lastSample.current;
    if (prev && now > prev.at) {
      const km = haversineKm(prev.at_pos, coords);
      const hours = (now - prev.at) / 3_600_000;
      if (hours > 0) {
        const kmh = km / hours;
        // Smooth a bit; ignore obvious GPS jitter spikes.
        if (kmh < 200) setSpeedKmh((s) => s * 0.4 + kmh * 0.6);
      }
    }
    lastSample.current = { at: now, at_pos: coords };

    // Auto-arrive if within 300 m of destination.
    if (haversineKm(coords, destination) * 1000 < 300) {
      setPhase("arrived");
      stopWatch();
    }
  }, [coords, phase, destination, stopWatch]);

  const distanceRemainingKm = useMemo(
    () => haversineKm(coords, destination),
    [coords, destination]
  );

  const distanceCoveredKm = useMemo(() => {
    let total = 0;
    for (let i = 1; i < trail.length; i++) total += haversineKm(trail[i - 1], trail[i]);
    return total;
  }, [trail]);

  const elapsedMinutes = startedAt
    ? Math.max(0, (Date.now() - startedAt) / 60_000)
    : 0;

  // ETA: if we have a live speed > 5 km/h, use it; else fall back to seeded.
  const etaMinutes = useMemo(() => {
    if (speedKmh > 5) return (distanceRemainingKm / speedKmh) * 60;
    return route ? (route.durationMinutes * distanceRemainingKm) / (route.distanceKm || 1) : trip.drivingMinutes;
  }, [speedKmh, distanceRemainingKm, route, trip.drivingMinutes]);

  const eta = useMemo(() => addMinutes(new Date(), etaMinutes), [etaMinutes]);

  function start() {
    if (status !== "granted") request();
    startWatch();
    setStartedAt(Date.now());
    setTrail([coords]);
    setPhase("tracking");
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
    setTrail([]);
    setStartedAt(null);
    setSpeedKmh(0);
    lastSample.current = null;
  }

  return (
    <div className="grid grid-rows-[1fr_auto] md:grid-rows-1 md:grid-cols-[1fr_22rem]" style={{ minHeight: "calc(100vh - 53px)" }}>
      {/* Map fills viewport on mobile, panel docks on the right for desktop */}
      <div className="relative h-[55vh] md:h-[calc(100vh-53px)]">
        <TripMap
          origin={coords}
          destination={destination}
          destinationName={trip.name}
          route={route?.geometry}
          trail={trail}
        />
        {phase === "tracking" && (
          <div className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold text-white shadow-lg backdrop-blur">
            <span className="block h-2 w-2 animate-pulse rounded-full bg-white" />
            Live
          </div>
        )}
      </div>

      {/* Telemetry + controls */}
      <div className="flex flex-col gap-3 bg-slate-900 p-4 text-white">
        <header className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Heading to
            </p>
            <h2 className="text-lg font-bold">{trip.name}</h2>
          </div>
          <PhasePill phase={phase} />
        </header>

        <div className="grid grid-cols-2 gap-2">
          <Stat
            icon={<Navigation className="h-4 w-4" />}
            label="Remaining"
            value={formatKm(distanceRemainingKm)}
          />
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label="ETA"
            value={formatClock(eta)}
            sub={`in ${formatMinutes(etaMinutes)}`}
          />
          <Stat
            icon={<Gauge className="h-4 w-4" />}
            label="Speed"
            value={`${Math.round(speedKmh)} km/h`}
            sub={speedKmh > 0 ? "live" : "—"}
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
          {phase === "arrived" && (
            <div className="col-span-2 flex items-center gap-2 rounded-xl bg-emerald-600/30 px-4 py-3 text-sm font-bold text-emerald-200">
              <Sparkles className="h-5 w-5" />
              Arrived at {trip.name}! Trip duration {formatMinutes(elapsedMinutes)}.
              <button
                type="button"
                onClick={stop}
                className="ml-auto inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs text-white hover:bg-emerald-400"
              >
                Done <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-500">
          Live tracking uses your browser's GPS. Keep this tab open while moving.
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

function PhasePill({ phase }: { phase: Phase }) {
  const map: Record<Phase, { label: string; cls: string }> = {
    ready: { label: "Ready", cls: "bg-slate-700 text-slate-200" },
    tracking: { label: "Tracking", cls: "bg-emerald-500 text-white" },
    paused: { label: "Paused", cls: "bg-amber-500 text-white" },
    arrived: { label: "Arrived", cls: "bg-violet-500 text-white" },
  };
  const m = map[phase];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${m.cls}`}>
      {m.label}
    </span>
  );
}
