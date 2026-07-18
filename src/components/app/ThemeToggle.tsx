"use client";

// Header light ⇄ black theme toggle. Writes `data-theme` on <html> via the
// ThemeProvider, which re-skins the whole app (see globals.css).
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to black theme"}
      title={isDark ? "Light theme" : "Black theme"}
      className="grid h-10 w-10 place-items-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-2)] active:scale-90"
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-400" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
