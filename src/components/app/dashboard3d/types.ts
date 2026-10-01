import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface SpatialModule {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Big glanceable number/string shown on the panel's face. */
  value: string;
  /**
   * CSS-space position, not a WebGL world coordinate:
   *   [xPercent, yPercent, depth]
   * x/y place the panel within the scene (percent of its container);
   * depth drives translateZ + a size/brightness falloff so panels read as
   * sitting at different distances under the scene's `perspective`. Positive
   * depth = closer to the viewer, negative = further away.
   */
  position: [number, number, number];
  /** Accent color for this module's glow/connection line (a CSS color string). */
  color: string;
  href: string;
  /** Rendered inside the deep-dive panel when this module is selected. */
  renderDeepDive: () => ReactNode;
}
