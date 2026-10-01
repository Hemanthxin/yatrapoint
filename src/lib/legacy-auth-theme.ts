import type { CSSProperties } from "react";

// The site-wide rebrand (cream canvas + sky-blue accent, see globals.css)
// deliberately left the sign-in/sign-up, OTP and admin-login screens alone.
// Those screens mostly use their own literal Tailwind colors already, but a
// few shared primitives (`.input`'s focus ring, `.card`) read the global
// accent/surface CSS variables — so without this, their look would still
// drift along with the rebrand even though no line in those files changed.
// Applied as an inline `style` on each screen's root element, this freezes
// the exact pre-rebrand variable values for everything inside it, via normal
// CSS custom-property inheritance.
export const LEGACY_AUTH_STYLE = {
  "--accent": "#1f6b45",
  "--accent-2": "#17573a",
  "--app-bg": "#f7f9f8",
  "--surface": "#ffffff",
  "--surface-2": "#f2f5f4",
  "--text": "#111814",
  "--text-soft": "#414b45",
  "--muted": "#7c857f",
  "--border": "#e8ebe9",
  "--nav-bg": "rgba(255, 255, 255, 0.85)",
  "--ring": "rgba(31, 107, 69, 0.14)",
} as CSSProperties;
