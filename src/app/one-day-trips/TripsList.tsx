"use client";

import { useMemo, useState } from "react";
import type { NearbyDestination } from "@/lib/db/schema";
import { useLocation } from "@/components/app/LocationContext";
import { sortByUserDistance } from "@/lib/nearby-utils";
import { NearbyTripCard } from "@/components/app/NearbyTripCard";
import { CATEGORIES } from "@/lib/catalog/categories";

interface TripsListProps {
  trips: NearbyDestination[];
}

export function TripsList({ trips }: TripsListProps) {
  const { coords } = useLocation();
  const [category, setCategory] = useState<string>("");
  const [maxDistance, setMaxDistance] = useState<number>(0);

  const sorted = useMemo(() => sortByUserDistance(trips, coords), [trips, coords]);
  const filtered = useMemo(
    () =>
      sorted.filter((d) => {
        if (category && d.category !== category) return false;
        if (maxDistance > 0 && d.userDistanceKm > maxDistance) return false;
        return true;
      }),
    [sorted, category, maxDistance]
  );

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Filter
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Within</span>
          <select
            value={maxDistance}
            onChange={(e) => setMaxDistance(Number(e.target.value))}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value={0}>Any distance</option>
            <option value={30}>30 km</option>
            <option value={60}>60 km</option>
            <option value={100}>100 km</option>
            <option value={150}>150 km</option>
          </select>
        </div>
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-wrap lg:px-0">
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

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-3xl">🗺️</p>
          <p className="mt-2 text-sm text-slate-500">
            No places match those filters. Try removing one.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <NearbyTripCard
              key={d.id}
              destination={d}
              userDistanceKm={d.userDistanceKm}
            />
          ))}
        </div>
      )}
    </>
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
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
        active
          ? "bg-emerald-600 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
