// Deterministic travel photos for places that have no stored image.
//
// IMPORTANT: LoremFlickr returns its generic "default" image when a tag combo
// has no match — so we use a SINGLE, broad category tag (which always matches a
// large pool) plus a per-place `lock` for variety. Every place therefore gets a
// stable, category-appropriate, DIFFERENT photo. A Picsum seed is the backup if
// LoremFlickr errors, and <PlaceImage> falls back to a gradient if both fail.

const CATEGORY_TAG: Record<string, string> = {
  hill_station: "mountains",
  adventure: "waterfall",
  pilgrimage: "temple",
  heritage: "fort",
  wildlife: "wildlife",
  beach: "beach",
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// Primary: a varied, category-relevant photo keyed to the place.
export function placeImageUrl(name: string, category?: string, w = 640, h = 480): string {
  const tag = CATEGORY_TAG[category ?? ""] ?? "landscape";
  return `https://loremflickr.com/${w}/${h}/${tag}?lock=${hash(name)}`;
}

// Backup: a guaranteed, varied real photo (used only if the primary fails).
export function fallbackImageUrl(name: string, w = 640, h = 480): string {
  return `https://picsum.photos/seed/${encodeURIComponent(name)}/${w}/${h}`;
}
