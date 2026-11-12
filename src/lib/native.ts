"use client";

import { useEffect, useState } from "react";

// The Saafera Android app (android-app/, built with Capacitor) loads this website inside a native shell and
// exposes phone features through `window.Capacitor`. In an ordinary browser none of this exists, so every
// helper here quietly does nothing.

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, Record<string, (...args: unknown[]) => unknown> | undefined>;
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export function isNativeApp(): boolean {
  try {
    return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function nativePlugin<T = Record<string, (...args: unknown[]) => unknown>>(name: string): T | null {
  if (!isNativeApp()) return null;
  return (window.Capacitor?.Plugins?.[name] as unknown as T) ?? null;
}

/** False on the server and on first paint, then true inside the Android app — so server and client markup agree. */
export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);
  return native;
}
