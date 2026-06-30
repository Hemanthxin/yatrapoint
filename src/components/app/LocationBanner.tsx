"use client";

import { useEffect } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { useLocation } from "./LocationContext";

// Inline status banner — appears above pages that depend on the user's
// coordinates. Auto-requests on mount.
export function LocationBanner({
  autoRequest = true,
}: {
  autoRequest?: boolean;
}) {
  const loc = useLocation();

  useEffect(() => {
    if (autoRequest && loc.status === "idle") loc.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequest]);

  if (loc.status === "granted") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-emerald-800">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <MapPin className="h-4 w-4" />
          </span>
          Using your live location
          {loc.accuracyMeters && (
            <span className="text-xs font-medium text-emerald-700/70">
              (±{Math.round(loc.accuracyMeters)} m)
            </span>
          )}
        </span>
        <span className="rounded-full bg-emerald-100/70 px-2.5 py-1 text-xs font-medium text-emerald-700/80">
          {loc.coords.lat.toFixed(4)}, {loc.coords.lng.toFixed(4)}
        </span>
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-amber-900">
        <AlertCircle className="h-4 w-4" />
        {loc.status === "denied"
          ? "Location denied — using Bangalore centre as a fallback."
          : loc.status === "unavailable"
          ? "Location unavailable on this device — using Bangalore centre."
          : "We need your location to sort places by distance."}
      </span>
      <button
        type="button"
        onClick={loc.request}
        className="inline-flex h-9 items-center rounded-full border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-900 transition hover:scale-[1.02] hover:bg-amber-100 active:scale-95"
      >
        {loc.status === "denied" ? "Try again" : "Use my location"}
      </button>
    </div>
  );
}
