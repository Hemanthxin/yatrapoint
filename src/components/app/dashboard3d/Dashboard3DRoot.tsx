"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Wallet, Binoculars, Briefcase, MapPinned, CloudSun } from "lucide-react";

import type { DashboardStats, UpcomingTrip } from "@/lib/queries/trip-plans";
import type { CityPlace } from "@/lib/db/schema";
import { formatINR } from "@/lib/format";
import { Sidebar } from "@/components/app/Sidebar";
import { SpatialProvider, useSpatial } from "./SpatialStore";
import { Scene } from "./Scene";
import { FloatingDock } from "./FloatingDock";
import { DeepDivePanel } from "./DeepDivePanel";
import { WeatherDeepDive } from "./WeatherModule";
import type { SpatialModule } from "./types";

interface Props {
  firstName: string;
  stats: DashboardStats;
  upcoming: UpcomingTrip[];
  citySeed: CityPlace[];
}

export function Dashboard3DRoot({ firstName, stats, upcoming, citySeed }: Props) {
  // Guard against mounting a full WebGL context on a narrow viewport — the
  // parent page already CSS-hides this on mobile (`hidden lg:block`), but
  // that alone still mounts the component and spins up the Canvas; this stops
  // the actual expensive work from ever starting there, where the lightweight
  // MobileDashboard is the real intended experience.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const check = () => setReady(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const modules = useMemo<SpatialModule[]>(() => {
    const nearby = citySeed.slice(0, 5);
    return [
      {
        id: "planner",
        label: "Trip Planner",
        icon: Wallet,
        value: formatINR(stats.totalBudget),
        position: [-3.2, 1.3, -1],
        color: "#60a5fa",
        href: "/budget-planner",
        renderDeepDive: () => (
          <div className="space-y-3">
            <Row label="Total planned budget" value={formatINR(stats.totalBudget)} />
            <Row label="Estimated savings" value={formatINR(stats.totalSaved)} />
            <Row label="Trips planned" value={String(stats.tripsPlanned)} />
          </div>
        ),
      },
      {
        id: "places",
        label: "Places Explored",
        icon: Binoculars,
        value: String(stats.placesExplored),
        position: [3.0, 1.8, -2],
        color: "#22d3ee",
        href: "/destinations",
        renderDeepDive: () => (
          <p className="text-sm leading-relaxed text-white/70">
            You've saved <span className="font-bold text-white">{stats.placesExplored}</span> place
            {stats.placesExplored === 1 ? "" : "s"} to your favourites. Open Destinations to explore more and add to
            the list.
          </p>
        ),
      },
      {
        id: "upcoming",
        label: "Upcoming Trips",
        icon: Briefcase,
        value: upcoming.length ? `${upcoming.length} planned` : "None yet",
        position: [-3.6, -1.4, -2.5],
        color: "#818cf8",
        href: "/one-day-trips",
        renderDeepDive: () =>
          upcoming.length === 0 ? (
            <p className="text-sm text-white/60">No saved trips yet — build one in the Budget Planner.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((t) => (
                <li key={t.id} className="rounded-xl bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/50">
                    {t.days} day{t.days === 1 ? "" : "s"} · {t.status}
                  </p>
                </li>
              ))}
            </ul>
          ),
      },
      {
        id: "nearby",
        label: "Nearby Places",
        icon: MapPinned,
        value: nearby.length ? `${nearby.length} curated` : "Explore",
        position: [3.4, -1.0, -1.5],
        color: "#38bdf8",
        href: "/explore-bangalore",
        renderDeepDive: () =>
          nearby.length === 0 ? (
            <p className="text-sm text-white/60">Allow location access to see what's near you.</p>
          ) : (
            <ul className="space-y-2">
              {nearby.map((p) => (
                <li key={p.id} className="rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-white/85">
                  {p.name}
                </li>
              ))}
            </ul>
          ),
      },
      {
        id: "weather",
        label: "Weather",
        icon: CloudSun,
        value: "Live",
        position: [0, -2.6, -3],
        color: "#67e8f9",
        href: "/dashboard",
        renderDeepDive: () => <WeatherDeepDive />,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, upcoming, citySeed]);

  const heroNodes = upcoming.slice(0, 4).map((t) => ({ id: t.id, label: t.name }));

  return (
    <SpatialProvider>
      <Dashboard3DInner firstName={firstName} stats={stats} modules={modules} heroNodes={heroNodes} ready={ready} />
    </SpatialProvider>
  );
}

function Dashboard3DInner({
  firstName,
  stats,
  modules,
  heroNodes,
  ready,
}: {
  firstName: string;
  stats: DashboardStats;
  modules: SpatialModule[];
  heroNodes: { id: string; label: string }[];
  ready: boolean;
}) {
  const { selectedId } = useSpatial();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative h-full w-full" style={{ background: "radial-gradient(120% 100% at 50% 0%, #0b1220 0%, #05070d 60%, #020306 100%)" }}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} forceOverlay />

      {/* Greeting — plain HTML, always crisp regardless of what the scene behind it is doing. */}
      <div className="pointer-events-none absolute left-6 top-6 z-20 lg:left-10 lg:top-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">Saafera · Spatial</p>
        <h1 className="mt-1 text-2xl font-bold text-white lg:text-3xl">Welcome back, {firstName}</h1>
      </div>

      {ready ? (
        <Canvas
          camera={{ position: [0, 1.2, 11], fov: 45 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: false }}
        >
          <Scene
            modules={modules}
            heroHeadline={stats.tripsPlanned}
            heroLabel="Trips Planned"
            heroSubLines={[`${formatINR(stats.totalBudget)} planned budget`, `${stats.placesExplored} places explored`]}
            heroNodes={heroNodes}
          />
        </Canvas>
      ) : (
        <div className="grid h-full place-items-center text-sm text-white/40">Loading spatial view…</div>
      )}

      <FloatingDock onMenu={() => setMenuOpen(true)} />
      {!selectedId && (
        <p className="pointer-events-none absolute bottom-28 left-1/2 z-20 -translate-x-1/2 text-center text-[11px] font-medium text-white/35">
          Drag to rotate · scroll to go deeper · click a panel to focus
        </p>
      )}
      <DeepDivePanel modules={modules} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
      <span className="text-xs font-medium text-white/55">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}
