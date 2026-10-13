"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Banknote, Check, CarFront, Phone, Star } from "lucide-react";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/cab/push-client";

interface Row {
  id: string;
  status: string;
  makeModel: string;
  plate: string;
  driverName: string;
  driverPhone: string;
  pickupText: string;
  dropText: string;
  pickupAt: string;
  fare: number;
  distanceKm: number | null;
  otp: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rating: number | null;
}

const PUSH_API = "/api/cars/push";
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

const STEPS = [
  { key: "requested", label: "Requested", at: (b: Row) => b.createdAt },
  { key: "accepted", label: "Accepted", at: (b: Row) => b.acceptedAt },
  { key: "arrived", label: "Driver arrived", at: (b: Row) => b.arrivedAt },
  { key: "started", label: "On the way", at: (b: Row) => b.startedAt },
  { key: "completed", label: "Completed", at: (b: Row) => b.completedAt },
];
const ORDER = STEPS.map((s) => s.key);

const ENDED: Record<string, { label: string; text: string }> = {
  declined: { label: "Driver declined", text: "This driver couldn't take your booking. You haven't been charged — pick another car." },
  cancelled: { label: "Cancelled", text: "This booking was cancelled." },
  expired: { label: "No response", text: "The driver didn't respond in time, so the request lapsed. Pick another car." },
};

export function BookingsList({ bookings }: { bookings: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [push, setPush] = useState<PushState | "loading">("loading");
  const [pushError, setPushError] = useState("");

  // Real time: a push wakes the page (via the service worker) and we refresh at once.
  // The slow poll below is only a safety net for when push isn't available.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => e.data?.type === "saafera-push" && router.refresh();
    navigator.serviceWorker?.addEventListener("message", onMsg);
    const id = setInterval(() => router.refresh(), push === "on" ? 20000 : 5000);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      clearInterval(id);
    };
  }, [router, push]);

  useEffect(() => {
    void getPushState(PUSH_API).then(setPush);
  }, []);

  async function togglePush() {
    setPushError("");
    if (push === "on") return setPush(await disablePush(PUSH_API));
    const r = await enablePush(PUSH_API);
    setPush(r.state);
    if (r.error) setPushError(r.error);
  }

  async function post(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const res = await fetch(`/api/cars/bookings/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    setBusy("");
    if (data && !data.ok) alert(data.error);
    router.refresh();
  }

  if (bookings.length === 0) {
    return (
      <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
        <CarFront className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 font-bold text-slate-700">No car bookings yet</p>
        <Link href="/cars" className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white">
          Book a car
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {push !== "loading" && push !== "unsupported" && push !== "unconfigured" && (
        <div className={`flex items-center gap-3 rounded-2xl p-4 ${push === "on" ? "bg-emerald-50" : "bg-amber-50"}`}>
          <BellRing className={`h-5 w-5 shrink-0 ${push === "on" ? "text-emerald-600" : "text-amber-600"}`} />
          <div className="min-w-0 flex-1 text-sm">
            <b className="text-slate-900">{push === "on" ? "Live updates are on" : "Get live updates"}</b>
            <p className="text-slate-600">
              {push === "on"
                ? "We'll notify you the moment your driver accepts, arrives and finishes — even if this page is closed."
                : push === "denied"
                  ? "Notifications are blocked for this site. Allow them in your browser settings to get live updates."
                  : "Be told instantly when your driver accepts, arrives and finishes — even if this page is closed."}
            </p>
            {pushError && <p className="mt-1 font-semibold text-red-600">{pushError}</p>}
          </div>
          {push !== "denied" && (
            <button onClick={togglePush} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold ${push === "on" ? "bg-white text-slate-600" : "bg-emerald-600 text-white"}`}>
              {push === "on" ? "Turn off" : "Turn on"}
            </button>
          )}
        </div>
      )}

      {bookings.map((b) => {
        const ended = ENDED[b.status];
        const idx = ORDER.indexOf(b.status);
        const live = b.status === "accepted" || b.status === "arrived";
        return (
          <article key={b.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-slate-900">{b.makeModel}</h2>
                <p className="text-xs font-semibold text-slate-500">
                  {b.plate} · {b.driverName}
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold text-slate-900">₹{b.fare}</div>
                <div className="text-[11px] font-semibold text-slate-400">{b.distanceKm ? `~${b.distanceKm} km` : "estimate"}</div>
              </div>
            </div>

            <p className="mt-3 text-sm font-semibold text-slate-800">
              {b.pickupText} <span className="text-slate-400">→</span> {b.dropText}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Pickup {when(b.pickupAt)}</p>

            {ended ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-extrabold text-slate-700">{ended.label}</div>
                <p className="mt-0.5 text-sm text-slate-500">{ended.text}</p>
                {b.status !== "cancelled" && (
                  <Link href="/cars" className="mt-3 inline-block rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white">
                    Book another car
                  </Link>
                )}
              </div>
            ) : (
              <ol className="mt-4 grid grid-cols-5 gap-1">
                {STEPS.map((s, i) => {
                  const done = i < idx || b.status === "completed";
                  const current = i === idx && b.status !== "completed";
                  const at = s.at(b);
                  return (
                    <li key={s.key} className="flex flex-col items-center text-center">
                      <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold ${done ? "bg-emerald-600 text-white" : current ? "bg-amber-400 text-white ring-4 ring-amber-100" : "bg-slate-100 text-slate-400"}`}>
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className={`mt-1.5 text-[10px] font-bold leading-tight ${done || current ? "text-slate-800" : "text-slate-400"}`}>{s.label}</span>
                      <span className="text-[10px] text-slate-400">{at && (done || current) ? clock(at) : ""}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {b.status === "requested" && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                Waiting for <b>{b.driverName}</b> to respond. If there&apos;s no reply by <b>{clock(b.expiresAt)}</b> the request lapses and you can pick another car.
              </p>
            )}

            {live && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Your start code</div>
                  <div className="text-3xl font-extrabold tracking-[0.3em] text-emerald-900">{b.otp}</div>
                  <div className="text-xs text-emerald-800">{b.status === "arrived" ? "Your driver is waiting — tell them this code." : "Give this to the driver when you board."}</div>
                </div>
                <a href={`tel:${b.driverPhone}`} className="grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-white" aria-label="Call driver">
                  <Phone className="h-5 w-5" />
                </a>
              </div>
            )}

            {b.status === "started" && <p className="mt-3 rounded-xl bg-sky-50 px-3.5 py-2.5 text-sm text-sky-800">You&apos;re on your way to {b.dropText}. Have a safe trip!</p>}

            {b.status === "completed" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span>
                    Trip complete. Please pay <b>{b.driverName}</b> <b>₹{b.fare}</b> directly (cash or UPI) — Saafera doesn&apos;t take payment for car bookings.
                  </span>
                </div>
                {b.rating ? (
                  <div className="flex items-center gap-1 text-sm font-semibold text-slate-600">
                    You rated this trip
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < b.rating! ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                    ))}
                  </div>
                ) : (
                  <RateTrip disabled={busy === b.id} onRate={(rating, review) => post(b.id, { action: "rate", rating, review })} />
                )}
              </div>
            )}

            {(b.status === "requested" || b.status === "accepted") && (
              <button disabled={busy === b.id} onClick={() => confirm("Cancel this booking?") && post(b.id, { action: "cancel" })} className="mt-3 text-sm font-bold text-red-600 disabled:opacity-50">
                Cancel booking
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

function RateTrip({ onRate, disabled }: { onRate: (rating: number, review: string) => void; disabled: boolean }) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="text-sm font-extrabold text-slate-800">How was your trip?</div>
      <div className="mt-2 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}>
            <Star className={`h-8 w-8 ${n <= stars ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
          </button>
        ))}
      </div>
      {stars > 0 && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={400} placeholder="Add a comment (optional)" className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
          <button disabled={disabled} onClick={() => onRate(stars, text)} className="mt-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-extrabold text-white disabled:opacity-50">
            Submit rating
          </button>
        </>
      )}
    </div>
  );
}
