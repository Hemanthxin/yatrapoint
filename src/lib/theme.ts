// The three switchable app themes. `id` is written to <html data-theme> and
// persisted in localStorage; globals.css re-skins the whole app from it.
export const THEMES = [
  {
    id: "light",
    label: "Bold Light",
    emoji: "☀️",
    desc: "Clean white with punchy coral accents.",
  },
  {
    id: "dark",
    label: "Dark Premium",
    emoji: "🌙",
    desc: "Deep charcoal with a glowing coral accent.",
  },
  {
    id: "vibrant",
    label: "Vibrant",
    emoji: "🌈",
    desc: "Saturated indigo→magenta gradient, glassy cards.",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[];
export const DEFAULT_THEME: ThemeId = "light";
export const THEME_STORAGE_KEY = "yatra-point/theme";

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as string[]).includes(v);
}
