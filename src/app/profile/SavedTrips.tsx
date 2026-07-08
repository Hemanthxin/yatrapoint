"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { MapPin, Navigation, Trash2, Calendar, Users, Wallet } from "lucide-react";
import { formatINR } from "@/lib/format";
import { placeMapUrl } from "@/lib/maps";

const SAVED_TRIPS_KEY = "yatra-point/saved-trips";

interface SavedTrip {
  id: string;
  name: string;
  stops: { id: string; name: string; category: string; lat: number; lng: number }[];
  totals?: { cost?: number; distanceKm?: number };
  days?: number;
  people?: number;
  mapsUrl?: string;
  savedAt?: string;
}

// Trips generated in the Budget Planner and saved with the "Save trip" button
// live in the browser (they contain live OSM stops that aren't in the curated
// destinations table). We surface them here in the profile's Trips tab, merged
// above any server-saved catalogue trip plans.
export function SavedTrips({ dbPlans, hasDbPlans }: { dbPlans: ReactNode; hasDbPlans: boolean }) {
  const [trips, setTrips] = useState<SavedTrip[] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_TRIPS_KEY);
      const list = raw ? (JSON.parse(raw) as SavedTrip[]) : [];
      setTrips(Array.isArray(list) ? list : []);
    } catch {
      setTrips([]);
    }
  }, []);

  function remove(id: string) {
    setTrips((prev) => {
      const next = (prev ?? []).filter((t) => t.id !== id);
      try {
        localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Still hydrating from localStorage.
  if (trips === null) return <>{hasDbPlans ? dbPlans : null}</>;

  if (trips.length === 0 && !hasDbPlans) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-4xl">🧳</p>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          You haven&apos;t saved any trip plans yet.
        </p>
        <Link
          href="/budget-planner"
          className="mt-5 inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95"
        >
          Plan your first trip
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trips.map((t) => (
        <article
          key={t.id}
          className="card-hover overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
            <div>
              <h3 className="font-extrabold tracking-tight text-slate-900">{t.name}</h3>
              {t.savedAt && (
                <p className="text-xs text-slate-500">
                  Saved{" "}
                  {new Date(t.savedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              {typeof t.totals?.cost === "number" && (
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                  {formatINR(t.totals.cost)}
                </span>
              )}
              {t.days ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  {t.days} {t.days === 1 ? "day" : "days"}
                </span>
              ) : null}
              {t.people ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-emerald-600" />
                  {t.people}
                </span>
              ) : null}
              <button
                onClick={() => remove(t.id)}
                aria-label="Remove saved trip"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ul className="divide-y divide-slate-100">
            {t.stops.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                    {i + 1}
                  </span>
                  {s.name}
                </span>
                <a
                  href={placeMapUrl({ name: s.name, latitude: s.lat, longitude: s.lng })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  <MapPin className="h-3 w-3" /> Map
                </a>
              </li>
            ))}
          </ul>

          {t.mapsUrl && (
            <div className="border-t border-slate-100 p-3">
              <a
                href={t.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.01] active:scale-95"
              >
                <Navigation className="h-4 w-4" /> Open route in Google Maps
              </a>
            </div>
          )}
        </article>
      ))}

      {hasDbPlans && dbPlans}
    </div>
  );
}
