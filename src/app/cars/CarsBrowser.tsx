"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CarFront, CheckCircle2, Snowflake, Star, Users, X } from "lucide-react";

interface CarVehicle {
  id: string;
  type: string;
  makeModel: string;
  colour: string | null;
  plate: string;
  seats: number;
  ac: boolean;
  city: string;
  ratePerKm: number;
  baseFare: number;
  photoUrl: string | null;
  driverName: string;
  avgRating: number | null;
  ratingCount: number;
  trips: number;
}

interface BookedResult {
  fare: number;
  distanceKm: number | null;
  pickupAt: string;
}

const TYPES = ["all", "hatchback", "sedan", "suv", "tempo", "luxury"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// <input type="datetime-local"> wants local time without a zone.
function localInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CarsBrowser({ vehicles }: { vehicles: CarVehicle[] }) {
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<CarVehicle | null>(null);
  const shown = useMemo(() => (type === "all" ? vehicles : vehicles.filter((v) => v.type === type)), [vehicles, type]);

  return (
    <div className="mt-6">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              type === t ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t === "all" ? "All cars" : cap(t)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <CarFront className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700">No cars available right now</p>
          <p className="mt-1 text-sm text-slate-500">Drivers go online through the Saafera Captain driver app. Check back in a little while.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v) => (
            <article key={v.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="grid h-40 place-items-center bg-slate-100">
                {v.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.photoUrl} alt={v.makeModel} className="h-full w-full object-cover" />
                ) : (
                  <CarFront className="h-12 w-12 text-slate-300" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-extrabold text-slate-900">{v.makeModel}</h2>
                    <p className="text-xs font-semibold text-slate-500">
                      {cap(v.type)} · {v.colour ? `${v.colour} · ` : ""}
                      {v.city}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">₹{v.ratePerKm}/km</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                    <Users className="h-3.5 w-3.5" /> {v.seats} seats
                  </span>
                  {v.ac && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                      <Snowflake className="h-3.5 w-3.5" /> AC
                    </span>
                  )}
                  {v.baseFare > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1">Base ₹{v.baseFare}</span>}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    {v.driverName}
                    {v.avgRating ? (
                      <span className="inline-flex items-center gap-0.5 text-slate-700">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {v.avgRating} <span className="font-medium text-slate-400">({v.ratingCount})</span>
                      </span>
                    ) : (
                      <span className="font-medium text-slate-400">{v.trips > 0 ? `${v.trips} trips` : "New"}</span>
                    )}
                  </span>
                  <button onClick={() => setSelected(v)} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md shadow-emerald-500/30 transition active:scale-95">
                    Book
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && <BookingSheet vehicle={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BookingSheet({ vehicle, onClose }: { vehicle: CarVehicle; onClose: () => void }) {
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [when, setWhen] = useState(() => localInputValue(new Date(Date.now() + 60 * 60000)));
  const [pax, setPax] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<BookedResult | null>(null);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/cars/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: vehicle.id, pickupText: pickup, dropText: drop, pickupAt: new Date(when).toISOString(), passengers: pax, note }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "Could not send the request.");
      else setDone({ fare: data.booking.fare, distanceKm: data.booking.distanceKm, pickupAt: data.booking.pickupAt });
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium outline-none focus:border-emerald-500";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">{done ? "Request sent" : `Book ${vehicle.makeModel}`}</h3>
            <p className="text-xs font-semibold text-slate-500">
              {vehicle.plate} · Driver {vehicle.driverName}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <p className="mt-3 text-lg font-extrabold text-slate-900">{vehicle.driverName} has been notified</p>
            <p className="mt-1 text-sm text-slate-500">
              Estimated fare <b className="text-slate-800">₹{done.fare}</b>
              {done.distanceKm ? ` for about ${done.distanceKm} km` : " — the final fare depends on the distance"}. You'll see it here as soon as the driver accepts.
            </p>
            <Link href="/cars/bookings" className="mt-6 block rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white">
              View my bookings
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Pickup
              <input className={field} value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="e.g. MG Road Metro, Bengaluru" />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Drop
              <input className={field} value={drop} onChange={(e) => setDrop(e.target.value)} placeholder="e.g. Mysuru Palace" />
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                Pickup time
                <input type="datetime-local" className={field} value={when} onChange={(e) => setWhen(e.target.value)} />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                People
                <input type="number" min={1} max={vehicle.seats} className={`${field} w-20`} value={pax} onChange={(e) => setPax(Number(e.target.value) || 1)} />
              </label>
            </div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Note for the driver (optional)
              <textarea className={`${field} resize-none`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Luggage, child seat, landmark…" />
            </label>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
            <p className="text-xs text-slate-500">
              ₹{vehicle.ratePerKm}/km{vehicle.baseFare ? ` + ₹${vehicle.baseFare} base` : ""}. You see the estimate once the request is sent.
            </p>
            <button disabled={busy || !pickup.trim() || !drop.trim()} onClick={submit} className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-md shadow-emerald-500/30 transition active:scale-[0.98] disabled:opacity-50">
              {busy ? "Sending…" : "Send request to driver"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
