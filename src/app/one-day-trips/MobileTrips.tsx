"use client";

import { useMemo, useState } from "react";
import { Compass, SlidersHorizontal } from "lucide-react";
import type { NearbyDestination } from "@/lib/db/schema";
import { useLocation } from "@/components/app/LocationContext";
import { sortByUserDistance } from "@/lib/nearby-utils";
import { NearbyTripCard } from "@/components/app/NearbyTripCard";
import { CATEGORIES } from "@/lib/catalog/categories";
import { EmptyState } from "@/components/app/EmptyState";
import { NoDataIllustration } from "@/components/illustrations";
import { Reveal } from "@/components/app/Reveal";
import { RevealGrid } from "@/components/app/RevealGrid";

interface MobileTripsProps {
  trips: NearbyDestination[];
  baseCity?: string;
  // Pre-selected distance band from `?within=` (see TripsList) — BUG-16.
  initialMaxDistance?: number;
}

const DISTANCES = [
  { value: 0, label: "Any distance" },
  { value: 30, label: "≤ 30 km" },
  { value: 60, label: "≤ 60 km" },
  { value: 100, label: "≤ 100 km" },
  { value: 150, label: "≤ 150 km" },
];

// Bespoke, app-first mobile layout for the one-day trips list. Rendered only
// below `lg`. Mirrors TripsList's filter logic (category + max distance) against
// the same data source and reuses NearbyTripCard so all behaviour is preserved.
// Coral accent comes automatically from the mobile theme, so every `emerald`
// utility here paints coral on phones.
export function MobileTrips({
  trips,
  baseCity = "Bangalore",
  initialMaxDistance = 0,
}: MobileTripsProps) {
  const { coords } = useLocation();
  const [category, setCategory] = useState<string>("");
  const [maxDistance, setMaxDistance] = useState<number>(initialMaxDistance);

  const sorted = useMemo(() => sortByUserDistance(trips, coords), [trips, coords]);
  // Same fix as TripsList (BUG-15): the km chips filter on the trip's real
  // curated distance from the base city — what the label means — instead of
  // the live-GPS distance, which returned the wrong set (or nothing) for any
  // traveller not standing in the base city. Sort order still uses live GPS.
  const filtered = useMemo(
    () =>
      sorted.filter((d) => {
        if (category && d.category !== category) return false;
        if (maxDistance > 0 && d.distanceKm > maxDistance) return false;
        return true;
      }),
    [sorted, category, maxDistance]
  );

  return (
    <div className="space-y-5 pb-4">
      {/* Bold header */}
      <Reveal className="flex items-start gap-3" amount={0}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <Compass className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900">
            One-day trips
          </h1>
          <p className="mt-0.5 text-sm font-medium text-slate-500">
            {filtered.length} picks near <span className="font-bold text-emerald-600">{baseCity}</span>
          </p>
        </div>
      </Reveal>

      {/* Distance quick-filter chip rail */}
      <Reveal amount={0}>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Distance from {baseCity}
        </p>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
          {DISTANCES.map((d) => (
            <Chip
              key={d.value}
              active={maxDistance === d.value}
              onClick={() => setMaxDistance(d.value)}
            >
              {d.label}
            </Chip>
          ))}
        </div>
      </Reveal>

      {/* Category quick-filter chip rail */}
      <Reveal amount={0}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Category
        </p>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
          <Chip active={!category} onClick={() => setCategory("")}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.slug}
              active={category === c.slug}
              onClick={() => setCategory(c.slug)}
            >
              {c.emoji} {c.label}
            </Chip>
          ))}
        </div>
      </Reveal>

      {/* Single-column list of rich trip cards */}
      {filtered.length === 0 ? (
        <EmptyState
          illustration={NoDataIllustration}
          title="No places match those filters."
          description="Try removing one to see more trips."
        />
      ) : (
        <RevealGrid className="grid grid-cols-1 gap-4">
          {filtered.map((d) => (
            <NearbyTripCard
              key={d.id}
              destination={d}
              userDistanceKm={d.userDistanceKm}
            />
          ))}
        </RevealGrid>
      )}
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
        active
          ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
