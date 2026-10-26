"use client";

import { useEffect } from "react";
import { getMyConsentStatus } from "@/lib/actions/consent";

export const LOCATION_CONSENT_EVENT = "saafera-location-consent";

// When a signed-in person has withdrawn consent for location, every location
// request in the app (nearby places, weather, community posts, …) must stop —
// not just hide a button. All of them go through navigator.geolocation, so the
// one reliable place to enforce it is here: while consent is withdrawn, the
// calls fail exactly as if the browser permission had been denied, and the
// app's existing "no location" fallbacks take over.
export function LocationConsentGuard() {
  useEffect(() => {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) return;

    const original = {
      get: geo.getCurrentPosition.bind(geo),
      watch: geo.watchPosition.bind(geo),
    };
    let blocked = false;

    const denied = (): GeolocationPositionError =>
      ({ code: 1, message: "Location was turned off in Saafera settings.", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError;

    try {
      geo.getCurrentPosition = (ok, err, opts) => {
        if (blocked) {
          window.setTimeout(() => err?.(denied()), 0);
          return;
        }
        original.get(ok, err, opts);
      };
      geo.watchPosition = (ok, err, opts) => {
        if (blocked) {
          window.setTimeout(() => err?.(denied()), 0);
          return 0;
        }
        return original.watch(ok, err, opts);
      };
    } catch {
      return; // a browser that won't let us wrap geolocation: leave it alone
    }

    let alive = true;
    getMyConsentStatus()
      .then((s) => alive && (blocked = s.signedIn && !s.locationAllowed))
      .catch(() => {});
    const onChange = (e: Event) => {
      blocked = (e as CustomEvent<{ allowed: boolean }>).detail?.allowed === false;
    };
    window.addEventListener(LOCATION_CONSENT_EVENT, onChange);

    return () => {
      alive = false;
      window.removeEventListener(LOCATION_CONSENT_EVENT, onChange);
      try {
        geo.getCurrentPosition = original.get;
        geo.watchPosition = original.watch;
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}
