"use client";

import { useEffect } from "react";

// Registers the minimal static-asset-only service worker (public/sw.js) so
// the site qualifies as an installable PWA — required for wrapping it in an
// Android TWA for the Play Store. See sw.js for why it never caches
// per-user/HTML/API responses.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal — the app works identically without it.
    });
  }, []);
  return null;
}
