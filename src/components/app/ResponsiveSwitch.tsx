"use client";

import { useIsDesktop } from "./useIsDesktop";

// Renders EITHER the mobile or the desktop subtree — never both — so a page
// doesn't ship/hydrate two full copies of a long list. Defaults to mobile during
// SSR/first paint (this is a mobile-first app), so phones never flash; desktop
// swaps in after mount.
export function ResponsiveSwitch({
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
