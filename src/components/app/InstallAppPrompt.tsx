"use client";

import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";

const DISMISSED_KEY = "yatra-point/install-prompt-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own "already installed" flag — not in the DOM lib types.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}

// Chrome/Android already shows its OWN native "Install app" prompt
// automatically once the site meets PWA installability criteria (manifest +
// service worker + HTTPS) — we deliberately do NOT intercept
// `beforeinstallprompt`/call preventDefault(), so that default browser UI is
// left alone. The one gap is iOS Safari, which has no install-prompt API at
// all — this banner only ever covers that case, with a quick how-to.
export function InstallAppPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isIos()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // ignore — worst case the banner can show again
    }
    setShow(true);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] mx-auto max-w-md sm:inset-x-auto sm:right-4 sm:left-auto">
      <div className="card flex items-center gap-3 p-3 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[color:var(--text)]">Install Saafera</p>
          <p className="truncate text-xs text-[color:var(--muted)]">Tap Share, then "Add to Home Screen"</p>
        </div>
        <Share className="h-5 w-5 shrink-0 text-[color:var(--muted)]" aria-hidden />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
