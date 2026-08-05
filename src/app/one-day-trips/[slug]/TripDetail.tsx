"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  Navigation,
  Sparkles,
  Wallet,
  Play,
  MapPin,
  Ticket,
  ExternalLink,
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
  CATEGORY_GRADIENT,
  type CategorySlug,
} from "@/lib/catalog/categories";
import type { NearbyDestination } from "@/lib/db/schema";
import { placeDirectionsUrl } from "@/lib/maps";
import { Reveal } from "@/components/app/Reveal";
import { MediaCarousel } from "@/app/community/MediaCarousel";
import type { GalleryImage } from "@/lib/queries/place-gallery";
import { PlaceStatusBadgesFull } from "@/components/app/PlaceStatusBadges";

// Leaflet uses window — must be client-only.
const TripMap = dynamic(() => import("@/components/map/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[380px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

interface TripDetailProps {
  trip: NearbyDestination;
  gallery?: GalleryImage[];
}

export function TripDetail({ trip, gallery = [] }: TripDetailProps) {
  const { coords, isFallback } = useLocation();
  const destination = useMemo<LatLng>(
    () => ({ lat: Number(trip.latitude), lng: Number(trip.longitude) }),
    [trip.latitude, trip.longitude]
  );

  // Budget inputs
  const [vehicle, setVehicle] = useState<VehicleKind>(defaultBudgetParams.vehicle);
  const [people, setPeople] = useState(defaultBudgetParams.people);
  const [foodPerPerson, setFoodPerPerson] = useState(defaultBudgetParams.foodPerPerson);
  const [departureTime, setDepartureTime] = useState<string>(
    trip.bestStartTime || "06:30"
  );

  // OSRM route (driving polyline)
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setRouteLoading(true);
    setRouteError(null);
    fetchDrivingRoute(coords, destination, ctrl.signal)
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
  }, [coords, destination]);

  // Live distance / driving estimates
  const straightKm = useMemo(
    () => haversineKm(coords, destination),
    [coords, destination]
  );
  const drivingKm = route?.distanceKm ?? straightKm * 1.3; // 1.3x detour factor
  const drivingMins =
    route?.durationMinutes ?? trip.drivingMinutes; // fall back to seeded estimate

  // Build timeline anchored at departureTime today.
  const timeline = useMemo(() => {
    const [hh, mm] = departureTime.split(":").map(Number);
    const depart = new Date();
    depart.setHours(hh, mm, 0, 0);
    const arrive = addMinutes(depart, drivingMins);
    const lunchBufferMins = 60;
    const leave = addMinutes(arrive, trip.idealHoursAtPlace * 60);
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
        title: `Arrive at ${trip.name}`,
        body: `${formatKm(drivingKm)} · ${formatMinutes(drivingMins)} driving`,
        dot: "bg-gradient-to-br from-emerald-500 to-green-600 ring-emerald-100",
      },
      {
        when: leave,
        title: "Leave for home",
        body: `${trip.idealHoursAtPlace} hours at ${trip.name}`,
        dot: "bg-gradient-to-br from-amber-400 to-orange-500 ring-amber-100",
      },
      {
        when: homeBack,
        title: "Back home",
        body: `Including a 1 hr food / break stop on the return`,
        dot: "bg-gradient-to-br from-sky-400 to-indigo-500 ring-sky-100",
      },
    ];
  }, [departureTime, drivingMins, drivingKm, trip.idealHoursAtPlace, trip.name, isFallback]);

  const budget = useMemo(
    () =>
      calcBudget({
        distanceKm: drivingKm,
        vehicle,
        people,
        entryFeePerPerson: trip.entryFeePerPerson,
        foodPerPerson,
        parkingFee: defaultBudgetParams.parkingFee,
        miscPerPerson: defaultBudgetParams.miscPerPerson,
      }),
    [drivingKm, vehicle, people, trip.entryFeePerPerson, foodPerPerson]
  );

  const cat = CATEGORY_BY_SLUG[trip.category as CategorySlug];
  const gradient =
    CATEGORY_GRADIENT[trip.category as CategorySlug] ??
    "from-slate-400 to-slate-600";

  const highlights = trip.highlights?.split(",").filter(Boolean) ?? [];

  return (
    <Reveal className="mt-4" amount={0}>
      {/* Hero — full-bleed on mobile */}
      <section className="bleed overflow-hidden rounded-none shadow-lg shadow-emerald-500/10 md:rounded-3xl md:border md:border-slate-200">
        <div
          className={`relative grid h-56 w-full place-items-center overflow-hidden bg-gradient-to-br ${gradient} sm:h-64 md:h-72`}
        >
          {gallery.length > 0 ? (
            <div className="absolute inset-0">
              <MediaCarousel
                media={gallery.map((g) => ({ url: g.url, kind: "image" }))}
                alt={trip.name}
                className="h-full w-full"
              />
            </div>
          ) : (
            <span className="text-8xl drop-shadow-lg">{cat?.emoji ?? "📍"}</span>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          {/* Emerald glow wash for that Play-Store hero pop. */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_110%,rgba(16,185,129,0.5),transparent_60%)] mix-blend-screen" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 backdrop-blur">
              {cat?.emoji} {cat?.label ?? trip.category}
            </span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white drop-shadow md:text-3xl">
              {trip.name}
            </h1>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-white/90">
              <MapPin className="h-4 w-4 shrink-0" />
              From {trip.baseCity} · {trip.distanceKm} km (seeded)
            </p>
          </div>
        </div>
        <div className="bg-white p-6">
          <PlaceStatusBadgesFull
            rating={trip.googleRating}
            ratingCount={trip.googleRatingCount}
            weeklyHoursJson={trip.googleWeeklyHours}
            className="mb-5"
          />
          <p className="text-sm leading-relaxed text-slate-700">{trip.description}</p>
          {highlights.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {highlights.map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  {h.trim()}
                </span>
              ))}
            </div>
          )}
          {trip.bookingUrl && (
            <a
              href={trip.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.02] active:scale-95"
            >
              <Ticket className="h-4 w-4" /> Book tickets
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Map + live distances */}
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
            destination={destination}
            destinationName={trip.name}
            route={route?.geometry}
            height={420}
          />
          {routeError && (
            <p className="mt-2 text-xs text-amber-600">{routeError}</p>
          )}

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

        {/* Budget + start trip */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-emerald-500/5">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
                <Wallet className="h-5 w-5" />
              </div>
              <p className="text-sm font-extrabold tracking-tight text-slate-900">
                Live budget
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Vehicle
                <div className="mt-1 grid grid-cols-5 gap-1.5">
                  {(Object.keys(VEHICLES) as VehicleKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setVehicle(k)}
                      className={`min-h-[44px] rounded-xl border px-2 py-1.5 text-sm transition active:scale-95 ${
                        vehicle === k
                          ? "border-transparent bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      aria-label={VEHICLES[k].label}
                      title={`${VEHICLES[k].label} · ₹${VEHICLES[k].costPerKm}/km`}
                    >
                      <span className="text-lg">{VEHICLES[k].emoji}</span>
                    </button>
                  ))}
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="People"
                  min={1}
                  max={20}
                  value={people}
                  onChange={setPeople}
                />
                <NumberField
                  label="Food / person"
                  min={0}
                  step={50}
                  value={foodPerPerson}
                  onChange={setFoodPerPerson}
                  prefix="₹"
                />
              </div>
            </div>

            <dl className="mt-5 grid gap-2 text-sm">
              <Row label={`Fuel (${formatKm(budget.roundTripKm)} round trip)`} value={formatINR(budget.fuelTotal)} />
              <Row label={`Entry × ${people}`} value={formatINR(budget.entryTotal)} />
              <Row label="Food" value={formatINR(budget.foodTotal)} />
              <Row label="Parking" value={formatINR(budget.parking)} />
              <Row label={`Misc × ${people}`} value={formatINR(budget.miscTotal)} />
              <div className="my-2 h-px bg-slate-200" />
              <div className="flex items-center justify-between">
                <dt className="text-base font-extrabold text-slate-900">Total</dt>
                <dd className="text-2xl font-extrabold text-gradient">
                  {formatINR(budget.total)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <dt>Per person</dt>
                <dd className="font-semibold">{formatINR(budget.perPerson)}</dd>
              </div>
            </dl>
          </div>

          <AddToCartButton
            className="w-full py-3 shadow-lg shadow-emerald-500/40"
            label="Plan a trip"
            item={{
              id: `nearby-${trip.id}`,
              name: trip.name,
              subtitle: trip.baseCity,
              kind: "trip",
              emoji: cat?.emoji ?? "📍",
              href: `/one-day-trips/${trip.slug}`,
            }}
          />
          <Link
            href={`/one-day-trips/${trip.slug}/live`}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95"
          >
            <span aria-hidden className="sheen-overlay animate-sheen" />
            <span className="relative flex items-center gap-2">
              <Play className="h-4 w-4 fill-current" />
              Start live tracking
            </span>
          </Link>
          <a
            href={placeDirectionsUrl({ name: trip.name, city: trip.baseCity }, coords)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
          >
            Open in Google Maps
          </a>
        </aside>
      </div>
    </Reveal>
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

