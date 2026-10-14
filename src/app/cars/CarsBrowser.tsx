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

interface Quote {
  pickup: { lat: number; lng: number; label: string };
  drop: { lat: number; lng: number; label: string };
  distanceKm: number;
  fare: number;
}

/** Reads an API reply. A timeout or crash on the server comes back as a web page, not JSON — say so,
 *  instead of blaming the user's network. */
async function readReply(res: Response): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const data = await res.json().catch(() => null);
  if (data) return data;
  return {
    ok: false,
    error:
      res.status === 504 || res.status === 408
        ? "Finding those places took too long. Add the city to each address (for example “Majestic, Bengaluru”) and try again."
        : "Something went wrong on our side. Please try again in a moment.",
  };
}

function BookingSheet({ vehicle, onClose }: { vehicle: CarVehicle; onClose: () => void }) {
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [when, setWhen] = useState(() => localInputValue(new Date(Date.now() + 60 * 60000)));
  const [pax, setPax] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null); // set once the places have been checked
  const [done, setDone] = useState<BookedResult | null>(null);

  // Editing any detail that affects the price sends the traveller back to re-check it.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setQuote(null);
    setError("");
  };

  function network(e: unknown) {
    const timedOut = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
    setError(timedOut ? "That took too long. Add the city to each address and try again." : "Can't reach Saafera. Check your internet connection and try again.");
  }

  async function checkPrice() {
    setError("");
    if (pickup.trim().toLowerCase() === drop.trim().toLowerCase()) {
      return setError("Pickup and drop are the same place. Enter where you're going.");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/cars/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: vehicle.id, pickupText: pickup, dropText: drop }),
        signal: AbortSignal.timeout(40000),
      });
      const data = await readReply(res);
      if (!data.ok) setError(data.error ?? "Could not check that trip.");
      else setQuote(data.quote as Quote);
    } catch (e) {
      network(e);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!quote) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/cars/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          pickupText: pickup,
          dropText: drop,
          pickupPlace: quote.pickup,
          dropPlace: quote.drop,
          pickupAt: new Date(when).toISOString(),
          passengers: pax,
          note,
        }),
        signal: AbortSignal.timeout(40000),
      });
      const data = await readReply(res);
      if (!data.ok) setError(data.error ?? "Could not send the request.");
      else {
        const b = data.booking as { fare: number; distanceKm: number | null; pickupAt: string };
        setDone({ fare: b.fare, distanceKm: b.distanceKm, pickupAt: b.pickupAt });
      }
    } catch (e) {
      network(e);
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
            <h3 className="text-lg font-extrabold text-slate-900">{done ? "Request sent" : quote ? "Check your trip" : `Book ${vehicle.makeModel}`}</h3>
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
              {done.distanceKm ? ` for about ${done.distanceKm} km` : ""}. You&apos;ll see it here as soon as the driver accepts.
            </p>
            <Link href="/cars/bookings" className="mt-6 block rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white">
              View my bookings
            </Link>
          </div>
        ) : quote ? (
          <div className="mt-4">
            <p className="text-sm text-slate-600">This is what we understood. If a place looks wrong, go back and add the city to it.</p>
            <div className="relative mt-4 space-y-4 pl-7">
              <span className="absolute bottom-3 left-[7px] top-3 w-0.5 bg-slate-200" />
              <div className="relative">
                <span className="absolute -left-7 top-1 h-3.5 w-3.5 rounded-full border-[3px] border-emerald-500 bg-white" />
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pickup</div>
                <div className="font-bold leading-tight text-slate-900">{quote.pickup.label}</div>
                <div className="text-xs text-slate-400">You typed: {pickup}</div>
              </div>
              <div className="relative">
                <span className="absolute -left-7 top-1 h-3.5 w-3.5 rounded-sm bg-red-500" />
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Drop</div>
                <div className="font-bold leading-tight text-slate-900">{quote.drop.label}</div>
                <div className="text-xs text-slate-400">You typed: {drop}</div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-emerald-50 p-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Estimated fare</div>
                <div className="text-3xl font-extrabold text-emerald-900">₹{quote.fare}</div>
              </div>
              <div className="text-right text-sm text-emerald-800">
                about {quote.distanceKm} km
                <div className="text-xs">
                  ₹{vehicle.ratePerKm}/km{vehicle.baseFare ? ` + ₹${vehicle.baseFare}` : ""}
                </div>
              </div>
            </div>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
            <div className="mt-4 grid grid-cols-[1fr_2fr] gap-3">
              <button disabled={busy} onClick={() => setQuote(null)} className="rounded-xl bg-slate-100 py-3.5 text-sm font-extrabold text-slate-700 disabled:opacity-50">
                Change
              </button>
              <button disabled={busy} onClick={send} className="rounded-xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-md shadow-emerald-500/30 transition active:scale-[0.98] disabled:opacity-50">
                {busy ? "Sending…" : "Send request to driver"}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">You pay the driver directly after the trip.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Pickup
              <input className={field} value={pickup} onChange={(e) => edit(setPickup)(e.target.value)} placeholder="e.g. Majestic, Bengaluru" />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Drop
              <input className={field} value={drop} onChange={(e) => edit(setDrop)(e.target.value)} placeholder="e.g. Mysuru Palace, Mysuru" />
            </label>
            <p className="-mt-1 text-xs text-slate-500">Tip: add the city to each place — “Majestic, Bengaluru” — so we find the right one.</p>
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
            <button disabled={busy || pickup.trim().length < 3 || drop.trim().length < 3} onClick={checkPrice} className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-md shadow-emerald-500/30 transition active:scale-[0.98] disabled:opacity-50">
              {busy ? "Finding your places…" : "Check price"}
            </button>
            <p className="text-center text-xs text-slate-400">
              ₹{vehicle.ratePerKm}/km{vehicle.baseFare ? ` + ₹${vehicle.baseFare} base` : ""}. Nothing is sent to the driver yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
