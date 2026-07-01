// Deterministic travel photos for places that have no stored image. Uses
// LoremFlickr (free, no key) keyed by the place name + category so each place
// gets a stable, relevant photo. If it ever fails to load, <PlaceImage> falls
// back to the category gradient.

const CATEGORY_TAGS: Record<string, string[]> = {
  hill_station: ["hills", "mountains"],
  adventure: ["waterfall", "nature"],
  pilgrimage: ["temple", "india"],
  heritage: ["fort", "palace", "heritage"],
  wildlife: ["wildlife", "forest"],
  beach: ["beach"],
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// A stable image URL for a place. Blends the place name (so famous places often
// get their real photo) with category keywords (so obscure ones still look right).
export function placeImageUrl(name: string, category?: string, w = 640, h = 480): string {
  const nameTags = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((x) => x.length > 2)
    .slice(0, 2);
  const catTags = CATEGORY_TAGS[category ?? ""] ?? ["india", "travel", "landscape"];
  const tags = [...nameTags, ...catTags].slice(0, 5).join(",");
  return `https://loremflickr.com/${w}/${h}/${tags}?lock=${hash(name)}`;
}
