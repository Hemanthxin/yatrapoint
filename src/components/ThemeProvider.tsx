"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, isThemeId, type ThemeId } from "@/lib/theme";

interface ThemeCtx {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const Ctx = createContext<ThemeCtx>({ theme: DEFAULT_THEME, setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // Adopt whatever the no-flash inline script already set on <html>, falling
  // back to the stored preference — so the context matches the painted theme.
  useEffect(() => {
    const fromDom = document.documentElement.getAttribute("data-theme");
    const fromStore =
      typeof localStorage !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    const initial = isThemeId(fromDom) ? fromDom : isThemeId(fromStore) ? fromStore : DEFAULT_THEME;
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function setTheme(t: ThemeId) {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      // ignore (private mode / quota)
    }
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}
