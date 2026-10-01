"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";

import { useLocation } from "@/components/app/LocationContext";
import { NumberField } from "@/components/app/NumberField";
import { fetchDrivingRoute } from "@/lib/routing";
import { formatKm, haversineKm, type LatLng } from "@/lib/geo";
import { formatINR } from "@/lib/format";
import { calcBudget, defaultBudgetParams, VEHICLES, type VehicleKind } from "@/lib/budget";
import type { Destination } from "@/lib/db/schema";

// The live budget panel: pick a vehicle, party size and food allowance, and
// see the real cost of the trip broken down line by line.
//
// This used to live inside DestinationDetail, so it existed only on the
// desktop layout — the mobile place screen's Budget tab showed a gauge and a
// vague range instead. It is a component now so both screens show the same
// numbers rather than two different answers to the same question.
//
// `drivingKm` is optional. DestinationDetail already fetches the road route
// for its map and timeline and passes the distance in; on its own (the mobile
// screen) the component fetches the route itself, falling back to the
// straight-line distance with a detour factor when the routing service is
// unavailable.
export function LiveBudget({
  place,
  drivingKm: drivingKmProp,
  className = "",
}: {
  place: Destination;
  drivingKm?: number;
  className?: string;
}) {
  const { coords } = useLocation();

  const lat = Number(place.latitude);
  const lng = Number(place.longitude);
  // `Number(null)` is 0, and (0, 0) is a real point in the Gulf of Guinea, so
  // a place with no stored coordinates has to be rejected explicitly or it
  // would show an identical ~8,600 km trip for every such place.
  const hasCoords =
    place.latitude != null &&
    place.longitude != null &&
    String(place.latitude).trim() !== "" &&
    String(place.longitude).trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0);

  const destPoint = useMemo<LatLng>(() => ({ lat, lng }), [lat, lng]);
  const [routeKm, setRouteKm] = useState<number | null>(null);

  useEffect(() => {
    // Nothing to fetch when the caller already knows the distance.
    if (drivingKmProp != null || !hasCoords) return;
    const ctrl = new AbortController();
    fetchDrivingRoute(coords, destPoint, ctrl.signal)
      .then((r) => setRouteKm(r ? r.distanceKm : null))
      .catch(() => setRouteKm(null));
    return () => ctrl.abort();
  }, [coords, destPoint, hasCoords, drivingKmProp]);

  const straightKm = hasCoords ? haversineKm(coords, destPoint) : 0;
  const drivingKm = drivingKmProp ?? routeKm ?? straightKm * 1.3;

  // Separate ticket types where a place has them (a zoo with a safari add-on),
  // otherwise the single entry fee.
  const ticketOptions = useMemo<{ label: string; price: number }[]>(() => {
    if (!place.ticketOptions) return [];
    try {
      const parsed = JSON.parse(place.ticketOptions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [place.ticketOptions]);

  const [ticketIdx, setTicketIdx] = useState(0);
  const entryFeePerPerson =
    ticketOptions.length > 0 ? ticketOptions[ticketIdx].price : place.entryFees;

  const [vehicle, setVehicle] = useState<VehicleKind>(defaultBudgetParams.vehicle);
  const [people, setPeople] = useState(defaultBudgetParams.people);
  const [foodPerPerson, setFoodPerPerson] = useState(defaultBudgetParams.foodPerPerson);

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

  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-emerald-500/5 ${className}`}
    >
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <Wallet className="h-5 w-5" />
        </div>
        <p className="text-sm font-extrabold tracking-tight text-slate-900">Live budget</p>
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
                className={`flex min-h-[64px] min-w-0 flex-col items-center justify-center rounded-xl border px-0.5 py-1.5 transition active:scale-95 ${
                  vehicle === k
                    ? "border-transparent bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                aria-label={VEHICLES[k].label}
                title={`${VEHICLES[k].label} · ₹${VEHICLES[k].costPerKm}/km`}
              >
                {/* The name, not just the glyph: five vehicle emoji side by
                    side are near-impossible to tell apart.

                    The label WRAPS rather than running past the edge of its
                    button. Five fixed cells across a phone leave roughly 50px
                    each, and "Hatchback" is wider than that, so it was being
                    cut off mid-word. */}
                <span className="text-lg leading-none">{VEHICLES[k].emoji}</span>
                <span className="mt-1 w-full break-words px-0.5 text-center text-[9px] font-semibold leading-[1.15]">
                  {VEHICLES[k].label}
                </span>
              </button>
            ))}
          </div>
        </label>

        {ticketOptions.length > 0 && (
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Ticket type
            <select
              value={ticketIdx}
              onChange={(e) => setTicketIdx(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              {ticketOptions.map((opt, i) => (
                <option key={i} value={i}>
                  {opt.label} — {formatINR(opt.price)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <NumberField label="People" min={1} max={20} value={people} onChange={setPeople} />
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
        {/* Travel costs only mean something when we know where the place is.
            Showing a fuel line for a place with no coordinates would be
            quoting a number for a journey we cannot measure. */}
        {hasCoords ? (
          <Row
            label={`Fuel (${formatKm(budget.roundTripKm)} round trip)`}
            value={formatINR(budget.fuelTotal)}
          />
        ) : (
          <Row label="Fuel" value="Location unknown" />
        )}
        <Row label={`Entry × ${people}`} value={formatINR(budget.entryTotal)} />
        <Row label="Food" value={formatINR(budget.foodTotal)} />
        <Row label="Parking" value={formatINR(budget.parking)} />
        <Row label={`Misc × ${people}`} value={formatINR(budget.miscTotal)} />
        <div className="my-2 h-px bg-slate-200" />
        <div className="flex items-center justify-between">
          <dt className="text-base font-extrabold text-slate-900">Total</dt>
          <dd className="text-2xl font-extrabold text-gradient">{formatINR(budget.total)}</dd>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <dt>Per person</dt>
          <dd className="font-semibold">{formatINR(budget.perPerson)}</dd>
        </div>
      </dl>
    </div>
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
