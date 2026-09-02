"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  Navigation,
  Sparkles,
  Wallet,
  MapPin,
} from "lucide-react";

import { useLocation } from "@/components/app/LocationContext";
import { AddToCartButton } from "@/components/app/AddToCartButton";
import { NumberField } from "@/components/app/NumberField";
import { fetchDrivingRoute, type RouteResult } from "@/lib/routing";
import {
  addMinutes,
  formatClock,
  formatKm,
  formatMinutes,
  haversineKm,
  type LatLng,
} from "@/lib/geo";
import { formatINR } from "@/lib/format";
import { calcBudget, defaultBudgetParams, VEHICLES, type VehicleKind } from "@/lib/budget";
import {
  CATEGORY_BY_SLUG,
  type CategorySlug,
} from "@/lib/catalog/categories";
import type { Destination } from "@/lib/db/schema";
import { placeDirectionsUrl, placeMapUrl } from "@/lib/maps";
import { LiveBudget } from "./LiveBudget";

// Leaflet uses window — must be client-only.
const TripMap = dynamic(() => import("@/components/map/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

// A single catalogue place doesn't carry a "hours at place" like the curated
// one-day trips do, so we assume a comfortable half-day visit for the timeline.
const IDEAL_HOURS_AT_PLACE = 4;

interface DestinationDetailProps {
  destination: Destination;
}

// The rich "live route + live budget + timeline" experience (mirrors the
// one-day-trips detail), now used for every catalogue place, plus the
// "Plan a trip" add-to-cart action.
export function DestinationDetail({ destination }: DestinationDetailProps) {
  const { coords, isFallback } = useLocation();

  const cat = CATEGORY_BY_SLUG[destination.category as CategorySlug];
  const placeLabel = destination.district
    ? `${destination.district}, ${destination.state}`
    : destination.state;

  const cartItem = {
    id: `dest-${destination.id}`,
    name: destination.name,
    subtitle: placeLabel,
    kind: "destination",
    emoji: cat?.emoji ?? "📍",
    href: `/destinations/${destination.slug}`,
  };

  const lat = Number(destination.latitude);
  const lng = Number(destination.longitude);
  // Many imported places have no stored coordinates (null/empty). `Number(null)`
  // is 0 — which is a real point off the coast of Africa — so we must reject
  // null/blank/(0,0) explicitly, otherwise every coordless place would draw the
  // same bogus ~8,600 km route to the Gulf of Guinea and show identical budgets.
  const hasCoords =
    destination.latitude != null &&
    destination.longitude != null &&
    String(destination.latitude).trim() !== "" &&
    String(destination.longitude).trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0);
  const destPoint = useMemo<LatLng>(() => ({ lat, lng }), [lat, lng]);

  // Some places (a zoo with a safari combo, a park with a butterfly-park
  // add-on) have genuinely separate ticket types rather than one flat entry
  // fee — parsed from JSON when present, ignored (silently falls back to the
  // single entryFees) if malformed or absent.
  const ticketOptions = useMemo<{ label: string; price: number }[]>(() => {
    if (!destination.ticketOptions) return [];
    try {
      const parsed = JSON.parse(destination.ticketOptions);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }, [destination.ticketOptions]);
  const [ticketIdx, setTicketIdx] = useState(0);
  const entryFeePerPerson = ticketOptions.length > 0 ? ticketOptions[ticketIdx].price : destination.entryFees;

  // Budget inputs.
  const [vehicle, setVehicle] = useState<VehicleKind>(defaultBudgetParams.vehicle);
  const [people, setPeople] = useState(defaultBudgetParams.people);
  const [foodPerPerson, setFoodPerPerson] = useState(defaultBudgetParams.foodPerPerson);
  const [departureTime, setDepartureTime] = useState<string>("08:00");

  // OSRM route (driving polyline) from the traveller's live location.
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCoords) return;
    const ctrl = new AbortController();
    setRouteLoading(true);
    setRouteError(null);
    fetchDrivingRoute(coords, destPoint, ctrl.signal)
      .then((r) => {
        if (!r) {
          setRouteError("Route service unavailable — showing straight-line.");
          setRoute(null);
        } else {
          setRoute(r);
        }
      })
      .catch(() => {
        setRouteError("Route service unavailable — showing straight-line.");
      })
      .finally(() => setRouteLoading(false));
    return () => ctrl.abort();
  }, [coords, destPoint, hasCoords]);

  const straightKm = useMemo(
    () => (hasCoords ? haversineKm(coords, destPoint) : 0),
    [coords, destPoint, hasCoords]
  );
  const drivingKm = route?.distanceKm ?? straightKm * 1.3; // 1.3x detour factor
  const drivingMins =
    route?.durationMinutes ?? Math.round((drivingKm / 40) * 60); // ~40 km/h fallback

  // Timeline anchored at departureTime today (a there-and-back day out).
  const timeline = useMemo(() => {
    const [hh, mm] = departureTime.split(":").map(Number);
    const depart = new Date();
    depart.setHours(hh, mm, 0, 0);
    const arrive = addMinutes(depart, drivingMins);
    const lunchBufferMins = 60;
    const leave = addMinutes(arrive, IDEAL_HOURS_AT_PLACE * 60);
    const homeBack = addMinutes(leave, drivingMins + lunchBufferMins);

    return [
      {
        when: depart,
        title: "Depart",
        body: `From ${isFallback ? "Bangalore (fallback)" : "your location"}`,
        dot: "bg-gradient-to-br from-emerald-500 to-green-600 ring-emerald-100",
      },
      {
        when: arrive,
        title: `Arrive at ${destination.name}`,
        body: `${formatKm(drivingKm)} · ${formatMinutes(drivingMins)} driving`,
        dot: "bg-gradient-to-br from-emerald-500 to-green-600 ring-emerald-100",
      },
      {
        when: leave,
        title: "Leave for home",
        body: `${IDEAL_HOURS_AT_PLACE} hours at ${destination.name}`,
        dot: "bg-gradient-to-br from-amber-400 to-orange-500 ring-amber-100",
      },
      {
        when: homeBack,
        title: "Back home",
        body: `Including a 1 hr food / break stop on the return`,
        dot: "bg-gradient-to-br from-sky-400 to-indigo-500 ring-sky-100",
      },
    ];
  }, [departureTime, drivingMins, drivingKm, destination.name, isFallback]);

  const budget = useMemo(
    () =>
      calcBudget({
        distanceKm: drivingKm,
        vehicle,
        people,
        entryFeePerPerson,
        foodPerPerson,
        parkingFee: defaultBudgetParams.parkingFee,
        miscPerPerson: defaultBudgetParams.miscPerPerson,
      }),
    [drivingKm, vehicle, people, entryFeePerPerson, foodPerPerson]
  );

  // The live budget panel is shared with the mobile place screen so both
  // show the same numbers. The road distance is passed in because it has
  // already been fetched here for the map and the timeline.
  const budgetAside = <LiveBudget place={destination} drivingKm={drivingKm} />;

  const ctas = (
    <>
      <AddToCartButton className="w-full py-3 shadow-lg shadow-emerald-500/40" label="Plan a trip" item={cartItem} />
      <a
        href={
          hasCoords
            ? placeDirectionsUrl(destination, coords)
            : placeMapUrl(destination)
        }
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
      >
        Open in Google Maps
      </a>
    </>
  );

  // No coordinates — can't draw a route/timeline; show the budget + actions.
  if (!hasCoords) {
    return (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 grid h-full min-h-[220px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          <span>
            <MapPin className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            Map route isn&apos;t available for this place yet — you can still plan the trip and
            estimate the budget.
          </span>
        </div>
        <aside className="space-y-4">
          {budgetAside}
          {ctas}
        </aside>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      {/* Map + live distances + timeline */}
      <section className="lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Route</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <Pill
              icon={<Navigation className="h-3.5 w-3.5 text-emerald-600" />}
              label={routeLoading ? "Fetching route…" : `${formatKm(drivingKm)} driving`}
            />
            <Pill
              icon={<Clock className="h-3.5 w-3.5 text-emerald-600" />}
              label={`${formatMinutes(drivingMins)} one-way`}
            />
            <Pill
              icon={<Sparkles className="h-3.5 w-3.5 text-emerald-600" />}
              label={`Straight-line ${formatKm(straightKm)}`}
            />
          </div>
        </div>
        <TripMap
          origin={coords}
          destination={destPoint}
          destinationName={destination.name}
          route={route?.geometry}
          height={420}
        />
        {routeError && <p className="mt-2 text-xs text-amber-600">{routeError}</p>}

        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
              <Calendar className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Timeline</h2>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <span className="text-xs text-slate-400">Depart at</span>
          </div>
          <ol className="relative space-y-4 border-l-2 border-emerald-100 pl-5">
            {timeline.map((t, i) => (
              <li key={i} className="relative">
                <span
                  className="absolute -left-[27px] grid h-4 w-4 place-items-center rounded-full bg-white"
                  style={{ top: 3 }}
                >
                  <span className={`block h-3 w-3 rounded-full ring-2 ${t.dot}`} />
                </span>
                <p className="text-sm font-semibold text-slate-900">
                  {formatClock(t.when)} · {t.title}
                </p>
                <p className="text-xs text-slate-500">{t.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Budget + plan a trip */}
      <aside className="space-y-4">
        {budgetAside}
        {ctas}
      </aside>
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {icon}
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

