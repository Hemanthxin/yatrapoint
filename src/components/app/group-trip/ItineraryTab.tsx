"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Wallet, Fuel, Ticket, Utensils, MapPin, Clock, Route } from "lucide-react";

import type { GroupTrip } from "@/lib/db/schema";
import type { GeneratedItinerary } from "@/lib/itinerary";
import { formatINR } from "@/lib/format";
import { formatKm, formatMinutes } from "@/lib/geo";

const TripMap = dynamic(() => import("@/components/map/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[280px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

export function ItineraryTab({
  trip,
  itinerary,
  isAdmin,
}: {
  trip: GroupTrip;
  itinerary: GeneratedItinerary | null;
  isAdmin: boolean;
  onChange: () => void;
}) {
  if (!itinerary) {
    return (
      <div className="card p-8 text-center">
        <Route className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm font-bold text-slate-700">No itinerary yet</p>
        <p className="mt-1 text-xs text-slate-500">
          {isAdmin
            ? "Confirm some places in the Decide tab, then generate the itinerary."
            : "The trip admin hasn't generated the itinerary yet — check back soon."}
        </p>
      </div>
    );
  }

  const hasCoords = trip.startLatitude && trip.startLongitude;
  const origin = hasCoords ? { lat: Number(trip.startLatitude), lng: Number(trip.startLongitude) } : null;
  const stops = itinerary.days.flatMap((d) => d.stops).map((s, i) => ({ lat: s.lat, lng: s.lng, name: s.name, active: false }));

  return (
    <div className="space-y-5">
      {origin && (
        <TripMap
          origin={origin}
          stops={stops}
          route={itinerary.geometry ?? undefined}
          height={280}
        />
      )}

      <div className="card space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold text-slate-900">Trip totals</p>
          <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" /> {formatKm(itinerary.totalDistanceKm)}
            <Clock className="ml-2 h-3.5 w-3.5 text-emerald-600" /> {formatMinutes(itinerary.totalDurationMinutes)}
          </span>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-2xl font-extrabold text-emerald-700">{formatINR(itinerary.cost.total)}</p>
          <p className="text-xs font-semibold text-emerald-600">{formatINR(itinerary.cost.perPersonCost)} / person</p>
        </div>
        <div className="divide-y divide-slate-100 text-sm">
          <CostRow icon={<Fuel className="h-4 w-4" />} label={`Fuel (${trip.vehicle})`} value={itinerary.cost.fuelTotal} />
          <CostRow icon={<Ticket className="h-4 w-4" />} label="Entry fees & activities" value={itinerary.cost.entryFeesTotal} />
          <CostRow icon={<Utensils className="h-4 w-4" />} label="Food" value={itinerary.cost.foodTotal} />
        </div>
      </div>

      <div className="space-y-4">
        {itinerary.days.map((d) => (
          <div key={d.day} className="card p-4">
            <p className="mb-3 text-sm font-extrabold text-slate-900">Day {d.day}</p>
            <ol className="relative space-y-3 border-l-2 border-emerald-100 pl-4">
              {d.stops.map((s) => (
                <li key={s.placeId} className="relative">
                  <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  <p className="text-sm font-bold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {s.arrivalKmFromPrev > 0 && `${formatKm(s.arrivalKmFromPrev)} · ${formatMinutes(s.arrivalMinutesFromPrev)} drive · `}
                    ~{Math.round(s.idealMinutes / 60) || 1}h visit
                    {s.entryFeePerPerson > 0 ? ` · ${formatINR(s.entryFeePerPerson)}/person` : " · Free"}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <Link href="/budget-planner" className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3 text-center text-xs font-bold text-slate-500">
        <Wallet className="h-3.5 w-3.5" /> Want Saafera to auto-plan a solo trip instead? Try the Budget Planner
      </Link>
    </div>
  );
}

function CostRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <span className="flex items-center gap-2 text-slate-600">
        <span className="text-emerald-600">{icon}</span> {label}
      </span>
      <span className="font-bold text-slate-900">{formatINR(value)}</span>
    </div>
  );
}
