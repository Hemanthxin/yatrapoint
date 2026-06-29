// User-facing category groups for trip planning. Each maps to one or more
// Overpass (OSM) categories used by the live planner API. Shared by the budget
// planner wizard (chips) and the live plan generator.
export interface CategoryGroup {
  slug: string;
  label: string;
  emoji: string;
  overpass: string[];
}

export const PLACE_GROUPS: CategoryGroup[] = [
  // Each place of worship is its OWN group — temples never pull in mosques,
  // churches or gurudwaras (each maps to a single religion-specific filter).
  { slug: "temples", label: "Temples", emoji: "🛕", overpass: ["temple"] },
  { slug: "mosques", label: "Mosques", emoji: "🕌", overpass: ["mosque"] },
  { slug: "churches", label: "Churches", emoji: "⛪", overpass: ["church"] },
  { slug: "gurudwaras", label: "Gurudwaras", emoji: "🛐", overpass: ["gurudwara"] },
  { slug: "museums", label: "Museums", emoji: "🏛️", overpass: ["museum"] },
  { slug: "parks", label: "Parks", emoji: "🌳", overpass: ["park", "garden"] },
  { slug: "lakes", label: "Lakes", emoji: "💧", overpass: ["lake"] },
  { slug: "viewpoints", label: "Viewpoints", emoji: "🌄", overpass: ["viewpoint"] },
  { slug: "heritage", label: "Heritage", emoji: "🏯", overpass: ["monument", "fort", "tourist_attraction"] },
  { slug: "malls", label: "Malls", emoji: "🛍️", overpass: ["mall"] },
  { slug: "markets", label: "Markets", emoji: "🧺", overpass: ["marketplace"] },
  { slug: "restaurants", label: "Restaurants", emoji: "🍽️", overpass: ["restaurant"] },
  { slug: "cafes", label: "Cafés", emoji: "☕", overpass: ["cafe"] },
  { slug: "nightlife", label: "Nightlife", emoji: "🍻", overpass: ["nightlife"] },
  { slug: "cinema", label: "Cinema", emoji: "🎬", overpass: ["cinema", "theatre"] },
  { slug: "amusement", label: "Amusement", emoji: "🎢", overpass: ["amusement", "zoo"] },
];

// Trip type → which category groups to pre-select.
export const TRIP_GROUPS: Record<string, string[]> = {
  Solo: ["viewpoints", "heritage", "museums", "cafes"],
  Couple: ["viewpoints", "parks", "lakes", "restaurants", "cafes"],
  Family: ["temples", "parks", "museums", "heritage", "restaurants"],
  Friends: ["amusement", "viewpoints", "nightlife", "restaurants", "cafes"],
};

// Resolve selected group slugs → unique Overpass categories for the API.
export function groupsToOverpass(slugs: Iterable<string>): string[] {
  const set = new Set(slugs);
  const out = new Set<string>();
  for (const g of PLACE_GROUPS) {
    if (set.has(g.slug)) for (const o of g.overpass) out.add(o);
  }
  return [...out];
}
