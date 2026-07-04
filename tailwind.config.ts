import type { Config } from "tailwindcss";

// Brand scale driven by CSS variables (--br-*, defined in globals.css). Desktop
// keeps GREEN; mobile flips to CORAL via a media query — so every emerald/green/
// teal utility recolors by screen size with no per-component edits.
const BRAND = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => [
    s,
    `rgb(var(--br-${s}) / <alpha-value>)`,
  ])
) as Record<string, string>;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        emerald: BRAND,
        green: BRAND,
        teal: BRAND,
        // Semantic tokens driven by the active theme (see globals.css).
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        brand: {
          green: "#16A34A",
          greenDark: "#15803D",
          greenLight: "#22C55E",
          navy: "#1B3E7A",
          dark: "#0B1B2B",
        },
      },
      fontFamily: {
        script: ["var(--font-script)", "cursive"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        blob: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(24px, -36px) scale(1.12)" },
          "66%": { transform: "translate(-22px, 22px) scale(0.94)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        // Pulsing emerald glow — used by the dock + raised Plan button.
        glow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16,185,129,0.45), 0 12px 34px -10px rgba(16,185,129,0.55)" },
          "50%": { boxShadow: "0 0 0 8px rgba(16,185,129,0), 0 18px 44px -8px rgba(16,185,129,0.7)" },
        },
        // Indigo variant for the admin console.
        glowIndigo: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(99,102,241,0.45), 0 12px 34px -10px rgba(99,102,241,0.55)" },
          "50%": { boxShadow: "0 0 0 8px rgba(99,102,241,0), 0 18px 44px -8px rgba(99,102,241,0.7)" },
        },
        // Diagonal light sweep across glass surfaces.
        sheen: {
          "0%": { transform: "translateX(-150%) skewX(-20deg)" },
          "100%": { transform: "translateX(250%) skewX(-20deg)" },
        },
        // Subtle scale breathing for ambient accents.
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        // Spring entrance for the floating dock.
        dockIn: {
          "0%": { opacity: "0", transform: "translateY(120%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Drifting hue + position for the aurora canvas.
        aurora: {
          "0%": { transform: "translate3d(-6%, 0, 0) rotate(0deg)" },
          "50%": { transform: "translate3d(6%, -4%, 0) rotate(8deg)" },
          "100%": { transform: "translate3d(-6%, 0, 0) rotate(0deg)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // Slow cinematic pan/zoom for full-bleed hero photography.
        kenburns: {
          "0%": { transform: "scale(1) translate(0, 0)" },
          "100%": { transform: "scale(1.15) translate(-2%, -2%)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.35s ease-out both",
        fadeUp: "fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        blob: "blob 18s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
        gradient: "gradientShift 8s ease infinite",
        glow: "glow 2.8s ease-in-out infinite",
        "glow-indigo": "glowIndigo 2.8s ease-in-out infinite",
        sheen: "sheen 3.5s ease-in-out infinite",
        breathe: "breathe 7s ease-in-out infinite",
        dockIn: "dockIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        aurora: "aurora 22s ease-in-out infinite",
        slideDown: "slideDown 0.22s cubic-bezier(0.22, 1, 0.36, 1) both",
        kenburns: "kenburns 20s ease-out alternate infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
