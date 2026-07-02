export const CATEGORIES = [
  { slug: "pilgrimage", label: "Pilgrimage", emoji: "🛕", color: "amber" },
  { slug: "adventure", label: "Adventure", emoji: "🏔️", color: "rose" },
  { slug: "beach", label: "Beach", emoji: "🏖️", color: "sky" },
  { slug: "hill_station", label: "Hill Station", emoji: "⛰️", color: "emerald" },
  { slug: "heritage", label: "Heritage", emoji: "🏯", color: "violet" },
  { slug: "wildlife", label: "Wildlife", emoji: "🐅", color: "lime" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_BY_SLUG = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c])
) as Record<CategorySlug, (typeof CATEGORIES)[number]>;

export function categoryLabel(slug: string): string {
  return CATEGORY_BY_SLUG[slug as CategorySlug]?.label ?? slug;
}

// Tailwind utility classes per category (kept here so JIT doesn't purge them).
export const CATEGORY_GRADIENT: Record<CategorySlug, string> = {
  pilgrimage: "from-amber-400 to-orange-500",
  adventure: "from-rose-500 to-red-600",
  beach: "from-sky-400 to-cyan-500",
  hill_station: "from-sky-400 to-emerald-500",
  heritage: "from-violet-500 to-purple-700",
  wildlife: "from-lime-500 to-green-700",
};

export const CATEGORY_CHIP: Record<CategorySlug, string> = {
  pilgrimage: "bg-amber-100 text-amber-800",
  adventure: "bg-rose-100 text-rose-800",
  beach: "bg-sky-100 text-sky-800",
  hill_station: "bg-emerald-100 text-emerald-800",
  heritage: "bg-violet-100 text-violet-800",
  wildlife: "bg-lime-100 text-lime-800",
};
