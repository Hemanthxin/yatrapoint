"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MapPin, Loader2, AlertCircle, Search, Pencil, X } from "lucide-react";
import { useLocation } from "./LocationContext";
import { searchLocation, type GeocodeHit } from "@/lib/actions/geo";

// Inline status banner — appears above pages that depend on the user's
// coordinates. Auto-requests on mount.
export function LocationBanner({
  autoRequest = true,
}: {
  autoRequest?: boolean;
}) {
  const loc = useLocation();
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (autoRequest && loc.status === "idle") loc.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequest]);

  if (loc.status === "granted") {
    // Above ~2km the fix is coming from IP/network lookup rather than GPS or
    // Wi-Fi positioning — desktop browsers without location hardware (most
    // laptops) fall back to this, and no permission or app setting can force
    // better accuracy out of it. Say so plainly, and offer a manual pick
    // instead of just showing a radius next to the word "live".
    const isCoarse = loc.source === "device" && (loc.accuracyMeters ?? 0) > 2000;
    return (
      <div className="space-y-2">
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${
            isCoarse ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <span className={`inline-flex flex-wrap items-center gap-2 font-semibold ${isCoarse ? "text-amber-900" : "text-emerald-800"}`}>
            <span
              className={`grid h-7 w-7 place-items-center rounded-full ${
                isCoarse ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <MapPin className="h-4 w-4" />
            </span>
            {isCoarse
              ? "Using an approximate location"
              : loc.source === "manual"
              ? "Using your selected location"
              : "Using your live location"}
            {loc.accuracyMeters && (
              <span className={`text-xs font-medium ${isCoarse ? "text-amber-700/80" : "text-emerald-700/70"}`}>
                (±{Math.round(loc.accuracyMeters)} m)
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {isCoarse && (
              <span className="text-xs font-medium text-amber-800/80">
                Low accuracy — enable Wi-Fi/GPS, or set it manually.
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                isCoarse ? "bg-amber-100/70 text-amber-700/80" : "bg-emerald-100/70 text-emerald-700/80"
              }`}
            >
              {loc.placeName ?? `${loc.coords.lat.toFixed(4)}, ${loc.coords.lng.toFixed(4)}`}
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                isCoarse
                  ? "border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                  : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              <Pencil className="h-3 w-3" /> {pickerOpen ? "Cancel" : "Set manually"}
            </button>
          </span>
        </div>

        {pickerOpen && (
          <LocationSearchPanel
            onPick={(lat, lng) => {
              loc.setManual(lat, lng);
              setPickerOpen(false);
            }}
            onUseDevice={() => {
              loc.request();
              setPickerOpen(false);
            }}
          />
        )}
      </div>
    );
  }

  if (loc.status === "prompting") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        Requesting your location…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-amber-900">
          <AlertCircle className="h-4 w-4" />
          {loc.status === "denied"
            ? "Location denied — using Bangalore centre as a fallback."
            : loc.status === "unavailable"
            ? "Location unavailable on this device — using Bangalore centre."
            : "We need your location to sort places by distance."}
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={loc.request}
            className="inline-flex h-9 items-center rounded-full border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-900 transition hover:scale-[1.02] hover:bg-amber-100 active:scale-95"
          >
            {loc.status === "denied" ? "Try again" : "Use my location"}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-900 transition hover:scale-[1.02] hover:bg-amber-100 active:scale-95"
          >
            <Pencil className="h-3 w-3" /> Set manually
          </button>
        </span>
      </div>

      {pickerOpen && (
        <LocationSearchPanel
          onPick={(lat, lng) => {
            loc.setManual(lat, lng);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

// A lightweight text search (no map) for correcting a wrong or missing
// location — the practical fix on devices without GPS/Wi-Fi positioning,
// where the browser can only ever report a coarse, IP-based fix.
function LocationSearchPanel({
  onPick,
  onUseDevice,
}: {
  onPick: (lat: number, lng: number) => void;
  onUseDevice?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setNote(null);
    if (query.trim().length < 3) {
      setNote("Type at least 3 characters.");
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const hits = await searchLocation(query);
      setResults(hits);
      if (hits.length === 0) setNote("No match found — try a nearby landmark or area name.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your area, e.g. Indiranagar, Bangalore"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Find
        </button>
      </form>

      {results.length > 0 && (
        <div className="max-h-40 overflow-auto rounded-xl border border-slate-200">
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lng}-${i}`}
              type="button"
              onClick={() => onPick(r.lat, r.lng)}
              className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="truncate">{r.label}</span>
            </button>
          ))}
        </div>
      )}

      {note && <p className="text-xs text-amber-700">{note}</p>}

      {onUseDevice && (
        <button
          type="button"
          onClick={onUseDevice}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <X className="h-3 w-3" /> Use device location instead
        </button>
      )}
    </div>
  );
}
