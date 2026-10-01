"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, Loader2 } from "lucide-react";

import { NumberField } from "@/components/app/NumberField";
import { useLocation } from "@/components/app/LocationContext";
import { VEHICLES, type VehicleKind } from "@/lib/budget";
import { createGroupTrip, listDistrictsForState } from "@/lib/actions/group-trips";

const VEHICLE_KINDS = Object.keys(VEHICLES) as VehicleKind[];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(startISO: string, endISO: string): number {
  const a = new Date(startISO + "T00:00:00Z").getTime();
  const b = new Date(endISO + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

export function NewGroupTripForm({ states }: { states: string[] }) {
  const router = useRouter();
  const { coords, status, placeName, request } = useLocation();

  const [name, setName] = useState("");
  const [startLabel, setStartLabel] = useState("");
  const [startCoords, setStartCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [destinationState, setDestinationState] = useState("");
  const [destinationDistrict, setDestinationDistrict] = useState("");
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);

  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDaysISO(todayISO(), 2));
  const days = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);

  const [travellers, setTravellers] = useState(4);
  const [totalBudget, setTotalBudget] = useState(20000);
  const [vehicle, setVehicle] = useState<VehicleKind>("suv");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!destinationState) {
      setDistricts([]);
      return;
    }
    setDistrictsLoading(true);
    listDistrictsForState(destinationState)
      .then(setDistricts)
      .catch(() => setDistricts([]))
      .finally(() => setDistrictsLoading(false));
  }, [destinationState]);

  function useMyLocation() {
    if (status === "idle" || status === "denied" || status === "unavailable") {
      request();
      return;
    }
    if (status === "granted") {
      setStartCoords({ lat: coords.lat, lng: coords.lng });
      if (!startLabel && placeName) setStartLabel(placeName);
    }
  }

  // Adopt a live location fix the moment it resolves, if the traveller asked
  // for one and hasn't already typed something more specific.
  useEffect(() => {
    if (status === "granted" && !startCoords) {
      setStartCoords({ lat: coords.lat, lng: coords.lng });
      if (!startLabel && placeName) setStartLabel(placeName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, placeName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || name.trim().length < 2) return setError("Give the trip a name.");
    if (!startLabel.trim()) return setError("Add a start location.");
    if (!destinationState) return setError("Choose a destination state.");

    setSubmitting(true);
    try {
      const res = await createGroupTrip({
        name: name.trim(),
        startLabel: startLabel.trim(),
        startLatitude: startCoords?.lat,
        startLongitude: startCoords?.lng,
        destinationState,
        destinationDistrict: destinationDistrict || undefined,
        destinationLabel: [destinationDistrict, destinationState].filter(Boolean).join(", "),
        startDate,
        endDate,
        days,
        travellers,
        totalBudget,
        vehicle,
      });
      if (!res.ok || !res.joinCode) {
        setError(res.error || "Could not create the trip.");
        return;
      }
      router.push(`/group-trip/${res.joinCode}/invite`);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Trip name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coorg Friends Trip" className="input" />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Start location</label>
        <div className="flex gap-2">
          <input
            value={startLabel}
            onChange={(e) => setStartLabel(e.target.value)}
            placeholder="Bengaluru, Karnataka"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={useMyLocation}
            title="Use my current location"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-blue-600 transition hover:bg-blue-50 active:scale-95"
          >
            {status === "prompting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          </button>
        </div>
        {startCoords && <p className="mt-1 text-[11px] text-blue-600">Location pinned — used for real route/distance estimates.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Destination state</label>
          <select
            value={destinationState}
            onChange={(e) => {
              setDestinationState(e.target.value);
              setDestinationDistrict("");
            }}
            className="input"
          >
            <option value="">Choose a state</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">District (optional)</label>
          <select
            value={destinationDistrict}
            onChange={(e) => setDestinationDistrict(e.target.value)}
            disabled={!destinationState || districtsLoading}
            className="input"
          >
            <option value="">{districtsLoading ? "Loading…" : "Any district"}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">End date</label>
          <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
        </div>
      </div>
      <p className="-mt-3 text-[11px] text-slate-400">{days} day{days > 1 ? "s" : ""} total</p>

      <NumberField label="Travellers" value={travellers} onChange={setTravellers} min={1} max={30} />
      <NumberField label="Total budget" value={totalBudget} onChange={setTotalBudget} min={500} max={10_000_000} step={500} prefix="₹" />

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicle (for cost estimate)</label>
        <div className="flex flex-wrap gap-2">
          {VEHICLE_KINDS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVehicle(v)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                vehicle === v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{VEHICLES[v].emoji}</span> {VEHICLES[v].label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full rounded-2xl py-3 text-sm disabled:opacity-60">
        {submitting ? "Creating…" : "Create Trip"}
      </button>
      <p className="text-center text-[11px] text-slate-400">👑 You'll be the trip admin.</p>
    </form>
  );
}
