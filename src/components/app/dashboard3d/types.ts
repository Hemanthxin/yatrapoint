import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface SpatialModule {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Big glanceable number/string shown on the panel's face. */
  value: string;
  /** Base position in 3D space — hover/select nudge from here, never replace it. */
  position: [number, number, number];
  /** Accent color for this module's glow/connection line (a CSS color string). */
  color: string;
  href: string;
  /** Rendered inside the deep-dive panel when this module is selected. */
  renderDeepDive: () => ReactNode;
}
