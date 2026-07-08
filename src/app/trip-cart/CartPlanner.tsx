"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Loader2, MapPin, Navigation, Trash2, ShoppingBag, Wallet, ExternalLink } from "lucide-react";

import { useCart, removeFromCart } from "@/lib/cart";
import { useLocation } from "@/components/app/LocationContext";
import { resolveTripStops, type TripStop } from "@/lib/actions/trip-cart";
import { placeMapUrl } from "@/lib/maps";

const TripMap = dynamic(() => import("@/components/map/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center rounded-3xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
      Loading map…
    </div>
  ),
});

export function CartPlanner() {
  const cart = useCart();
  const live = useLocation();
  const [stops, setStops] = useState<TripStop[] | null>(null);
  const [loading, setLoading] = useState(false);

  const sig = cart.map((c) => c.id).join(",");

  // Ask for location once so the route can start from where the traveller is.
  useEffect(() => {
    live.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve cart items → coordinates whenever the cart changes.
  useEffect(() => {
    if (cart.length === 0) {
      setStops([]);
      return;
    }
    setLoading(true);
    resolveTripStops(cart.map((c) => ({ id: c.id, name: c.name, subtitle: c.subtitle, kind: c.kind })))
      .then((s) => setStops(s))
      .catch(() => setStops([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const origin = live.coords;
  const mapStops = (stops ?? []).map((s) => ({ lat: s.lat, lng: s.lng, name: s.name }));

  const googleMapsUrl = (() => {
    if (!stops || stops.length === 0) return "#";
    const o = `${origin.lat},${origin.lng}`;
    const params = new URLSearchParams({ api: "1", origin: o, destination: o, travelmode: "driving" });
    const waypoints = stops.map((s) => `${s.lat},${s.lng}`).join("|");
    if (waypoints) params.set("waypoints", waypoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  })();

  if (cart.length === 0) {
    return (
      <div className="animate-fadeUp rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <p className="text-base font-extrabold tracking-tight text-slate-800">Your trip cart is empty.</p>
        <p className="mt-1 text-sm text-slate-400">Tap “Plan a trip” on any festival or place to add it here.</p>
        <Link
          href="/festivals"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.03] active:scale-95"
        >
          Browse festivals
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-36 lg:space-y-5 lg:pb-0">
      {loading && (
        <div className="grid h-44 place-items-center rounded-3xl border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-sm">
          <span className="flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
            Mapping your {cart.length} trip {cart.length === 1 ? "stop" : "stops"}…
          </span>
        </div>
      )}

      {!loading && stops && stops.length > 0 && (
        <>
          {/* Mobile (< lg): order-summary strip */}
          <div className="animate-fadeUp flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold tracking-tight text-slate-900">
                {stops.length} {stops.length === 1 ? "stop" : "stops"} in your route
              </p>
              <p className="text-xs font-medium text-slate-500">Mapped in order, ready to go.</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
              Ready
            </span>
          </div>

          {/* Route map */}
          <section className="animate-fadeUp">
            {/* Desktop (≥ lg): header row with inline CTA — unchanged */}
            <div className="mb-3 hidden flex-wrap items-center justify-between gap-2 lg:flex">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Your trip route</h2>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.03] active:scale-95"
              >
                <Navigation className="h-4 w-4" /> Open in Google Maps
              </a>
            </div>

            {/* Mobile (< lg): section heading only */}
            <h2 className="mb-2 text-base font-extrabold tracking-tight text-slate-900 lg:hidden">
              Your trip route
            </h2>

            {/* Framed map on mobile; bare on desktop */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-1.5 shadow-sm lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              <TripMap origin={origin} stops={mapStops} mode="flight" height={440} />
            </div>
            <p className="mt-2 px-1 text-xs text-slate-500 lg:px-0">
              Dotted arcs connect your saved festivals & places in order. The green pin is your location.
            </p>
          </section>

          {/* Stop list */}
          <section className="space-y-2">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-400 lg:hidden">
              Saved stops
            </h3>
            {stops.map((s, i) => (
              <div
                key={s.id}
                className="card-hover animate-fadeUp flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-xs font-bold text-white shadow-md shadow-emerald-500/30">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{s.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" /> {s.label}
                  </p>
                </div>
                <a
                  href={placeMapUrl({ name: s.name, latitude: s.lat, longitude: s.lng })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 lg:h-9 lg:w-9 lg:rounded-lg"
                  aria-label="Open on map"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => removeFromCart(s.id)}
                  aria-label="Remove"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 lg:h-9 lg:w-9 lg:rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </section>
        </>
      )}

      {!loading && stops && stops.length === 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Couldn’t locate any of your cart items on the map. Try adding places with a known location.
        </div>
      )}

      {/* Also plan the budget for these */}
      <Link
        href="/budget-planner"
        className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
      >
        <Wallet className="h-4 w-4" /> Plan budget & itinerary in the Budget Planner
      </Link>

      {/* Mobile (< lg): sticky bottom action bar floating above the dock */}
      {!loading && stops && stops.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-30 px-4 lg:hidden">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-600/30 transition active:scale-[0.98]"
          >
            <Navigation className="h-4 w-4" /> Plan these {stops.length}{" "}
            {stops.length === 1 ? "trip" : "trips"}
          </a>
        </div>
      )}
    </div>
  );
}
