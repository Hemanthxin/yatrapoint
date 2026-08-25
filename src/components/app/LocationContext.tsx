"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BANGALORE_CENTER, type LatLng } from "@/lib/geo";

type Status = "idle" | "prompting" | "granted" | "denied" | "unavailable";

interface LocationState {
  coords: LatLng;
  accuracyMeters?: number;
  status: Status;
  isFallback: boolean;
  request: () => void;
  startWatch: () => void;
  stopWatch: () => void;
  watching: boolean;
  lastUpdate?: number;
}

const Ctx = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<LatLng>(BANGALORE_CENTER);
  const [accuracyMeters, setAccuracyMeters] = useState<number | undefined>();
  const [status, setStatus] = useState<Status>("idle");
  const [watching, setWatching] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | undefined>();
  const watchId = useRef<number | null>(null);
  // Tracks the best (lowest) accuracy seen during the current request(), so
  // the brief refine-watch below never overwrites a good fix with a worse one.
  const bestAccuracyRef = useRef<number>(Infinity);
  const refineWatchId = useRef<number | null>(null);
  const refineTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((pos: GeolocationPosition) => {
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    setAccuracyMeters(pos.coords.accuracy);
    setLastUpdate(Date.now());
    setStatus("granted");
  }, []);

  const applyIfBetter = useCallback(
    (pos: GeolocationPosition) => {
      if (pos.coords.accuracy > bestAccuracyRef.current) return;
      bestAccuracyRef.current = pos.coords.accuracy;
      apply(pos);
    },
    [apply]
  );

  const stopRefine = useCallback(() => {
    if (refineWatchId.current !== null) {
      navigator.geolocation.clearWatch(refineWatchId.current);
      refineWatchId.current = null;
    }
    if (refineTimeoutId.current !== null) {
      clearTimeout(refineTimeoutId.current);
      refineTimeoutId.current = null;
    }
  }, []);

  const request = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("prompting");
    stopRefine();
    bestAccuracyRef.current = Infinity;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyIfBetter(pos);
        // The first fix is often a coarse network/IP-based estimate (city- or
        // country-level accuracy) that gets replaced by a much tighter GPS/Wi-Fi
        // fix a few seconds later. Keep listening briefly and adopt any better
        // reading, instead of freezing on that first coarse fix.
        refineWatchId.current = navigator.geolocation.watchPosition(
          (better) => {
            applyIfBetter(better);
            if (better.coords.accuracy <= 50) stopRefine();
          },
          () => {
            // A refine error doesn't invalidate the fix we already applied.
          },
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
        );
        refineTimeoutId.current = setTimeout(stopRefine, 15_000);
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  }, [applyIfBetter, stopRefine]);

  const startWatch = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    if (watchId.current !== null) return;
    stopRefine();
    watchId.current = navigator.geolocation.watchPosition(
      apply,
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 }
    );
    setWatching(true);
  }, [apply, stopRefine]);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setWatching(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      stopRefine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<LocationState>(
    () => ({
      coords,
      accuracyMeters,
      status,
      isFallback: status !== "granted",
      request,
      startWatch,
      stopWatch,
      watching,
      lastUpdate,
    }),
    [coords, accuracyMeters, status, request, startWatch, stopWatch, watching, lastUpdate]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation(): LocationState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocation must be used inside <LocationProvider>");
  return v;
}
