"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Wallet, Binoculars, Briefcase, MapPinned, CloudSun } from "lucide-react";

import type { DashboardStats, UpcomingTrip } from "@/lib/queries/trip-plans";
import { formatINR } from "@/lib/format";
import { Sidebar } from "@/components/app/Sidebar";
import { SpatialProvider, useSpatial } from "./SpatialStore";
import { Scene } from "./Scene";
import { OrbitalHero } from "./OrbitalHero";
import { FloatingModule } from "./FloatingModule";
import { ConnectionLines } from "./ConnectionLines";
import { ParticleField } from "./ParticleField";
import { FloatingDock } from "./FloatingDock";
import { DeepDivePanel } from "./DeepDivePanel";
import { WeatherDeepDive, useLiveWeather } from "./WeatherModule";
import { NearbyDeepDive } from "./NearbyModule";
import type { SpatialModule } from "./types";

interface Props {
  firstName: string;
  stats: DashboardStats;
  upcoming: UpcomingTrip[];
}

// A "3D data universe" dashboard built entirely from real CSS 3D transforms
// and Framer Motion — no WebGL. An earlier version used react-three-fiber,
// but it turned out to have a confirmed, unresolved incompatibility with
// Next.js 15's App Router (crashed on every load). This gets the same
// spatial/depth/parallax feel using a toolkit already proven elsewhere in
// this app (the dashboard's 3D logo hero, the landing page's mouse-parallax).
export function Dashboard3DRoot({ firstName, stats, upcoming }: Props) {
  // Lifted up from WeatherDeepDive so the live temperature can show on the
  // module's face too, not just once the deep-dive panel is opened — the
  // same data, read once here and reused by renderDeepDive() below.
  const weather = useLiveWeather();

  const modules = useMemo<SpatialModule[]>(() => {
    return [
      {
        id: "planner",
        label: "Trip Planner",
        icon: Wallet,
        value: formatINR(stats.totalBudget),
        position: [16, 22, 1],
        color: "#34d399",
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
        position: [84, 18, 2],
        color: "#2dd4bf",
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
        position: [12, 78, -1],
        color: "#4ade80",
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
        // Real nearby places need the traveller's live location, which this
        // static face value can't know ahead of time — same "Live" convention
        // as Weather below, resolved for real once the deep-dive opens.
        value: "Live",
        position: [87, 82, 0],
        color: "#6ee7b7",
        href: "/explore-bangalore",
        renderDeepDive: () => <NearbyDeepDive />,
      },
      {
        id: "weather",
        label: "Weather",
        icon: CloudSun,
        value: weather ? `${weather.temp}°C` : "Live",
        position: [50, 83, -2],
        color: "#86efac",
        href: "/dashboard",
        renderDeepDive: () => <WeatherDeepDive weather={weather} />,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, upcoming, weather]);

  const heroNodes = upcoming.slice(0, 4).map((t) => ({ id: t.id, label: t.name }));

  return (
    <SpatialProvider>
      <Dashboard3DInner firstName={firstName} stats={stats} modules={modules} heroNodes={heroNodes} />
    </SpatialProvider>
  );
}

function Dashboard3DInner({
  firstName,
  stats,
  modules,
  heroNodes,
}: {
  firstName: string;
  stats: DashboardStats;
  modules: SpatialModule[];
  heroNodes: { id: string; label: string }[];
}) {
  const { selectedId } = useSpatial();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Background scene image — a dark scrim on top keeps every panel and
          line of text legible over it regardless of how bright any one part
          of the photo is. */}
      <Image
        src="/dashboard-spatial-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 30%, rgba(3,10,6,0.45) 0%, rgba(2,8,5,0.78) 65%, rgba(1,4,2,0.94) 100%)",
        }}
      />

      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} forceOverlay />

      {/* Greeting — plain HTML, outside the 3D scene, always crisp. */}
      <div className="pointer-events-none absolute left-6 top-6 z-20 lg:left-10 lg:top-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/70">Saafera · Spatial</p>
        <h1 className="mt-1 text-2xl font-bold text-white lg:text-3xl">Welcome back, {firstName}</h1>
      </div>

      <Scene>
        <ConnectionLines modules={modules} />
        <ParticleField />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <OrbitalHero
            headline={stats.tripsPlanned}
            headlineLabel="Trips Planned"
            subLines={[`${formatINR(stats.totalBudget)} planned budget`, `${stats.placesExplored} places explored`]}
            nodes={heroNodes}
            dimmed={selectedId !== null}
          />
        </div>
        {modules.map((m) => (
          <FloatingModule key={m.id} mod={m} />
        ))}
      </Scene>

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
