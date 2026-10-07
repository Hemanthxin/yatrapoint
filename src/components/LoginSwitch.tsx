"use client";

import { useIsDesktop } from "@/components/app/useIsDesktop";

// Renders EITHER the mobile or the desktop login — never both. Both trees mount
// the Google Identity Services script; if both are in the DOM the scripts
// collide and the mobile Google button never initialises. Mounting only one
// fixes that (and avoids duplicate work). Defaults to mobile during SSR/first
// paint since this is a mobile-first app.
export function LoginSwitch({
  mobile,
  desktop,
}: {
  mobile: React.ReactNode;
  desktop: React.ReactNode;
}) {
  const isDesktop = useIsDesktop();
  // Pre-hydration: keep the mobile markup for phones/crawlers, but don't flash it
  // at desktop widths just before the painted story mounts.
  if (isDesktop === null) return <div className="lg:hidden">{mobile}</div>;
  return <>{isDesktop ? desktop : mobile}</>;
}
