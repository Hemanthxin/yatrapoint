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
  if (isDesktop === null) return <>{mobile}</>;
  return <>{isDesktop ? desktop : mobile}</>;
}
