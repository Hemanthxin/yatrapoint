"use client";

import { useEffect, useState } from "react";

// Returns true on desktop (≥1024px), false on mobile, and `null` until mounted.
// Used to render EITHER the mobile or the desktop tree for screens whose bodies
// run on-mount effects (live maps, geolocation) — so only one mounts and there's
// no double GPS prompt / double map. Default to mobile during SSR since this is
// a mobile-first app.
export function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isDesktop;
}
