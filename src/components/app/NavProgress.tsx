"use client";

// A slim top progress bar that gives instant "it's working" feedback the moment
// an internal link is clicked, then completes when the new route commits. The
// App Router has no navigation-start event, so we start the bar from a global
// capture-phase click listener on internal anchors and finish it when the
// pathname/search changes. No external dependency.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams.toString()}`;

  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearTimers = () => {
    if (trickle.current) clearInterval(trickle.current);
    if (done.current) clearTimeout(done.current);
    trickle.current = null;
    done.current = null;
  };

  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    clearTimers();
    setActive(true);
    setProgress(10);
    // Trickle toward ~90% while the server works; never reach 100 until commit.
    trickle.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(0.5, (90 - p) * 0.12)));
    }, 200);
  }, []);

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimers();
    setProgress(100);
    done.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 260);
  }, []);

  // Start the bar on any left-click of an in-app link to a different URL.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || target === "_blank" || anchor.hasAttribute("download")) return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
        return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Same page (or just a hash change) — nothing to load.
        if (url.pathname === window.location.pathname && url.search === window.location.search)
          return;
      } catch {
        return;
      }
      start();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  // Also start on browser back/forward.
  useEffect(() => {
    window.addEventListener("popstate", start);
    return () => window.removeEventListener("popstate", start);
  }, [start]);

  // Finish whenever the resolved URL changes (route committed).
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => clearTimers(), []);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 shadow-[0_0_10px_rgba(16,185,129,0.7)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
