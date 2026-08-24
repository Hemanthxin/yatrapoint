// Shared place de-duplication.
//
// The same real-world place reaches the app from several independent sources —
// the curated `destinations` catalogue, the bulk-seeded `city_places` table,
// the `nearby_destinations` day-trip list and live OpenStreetMap/Overpass —
// each with its own spelling and its own (sometimes several km off)
// coordinates. Without a single shared rule every list that unions those
// sources shows the same place two or three times (BUG-01), and a live API
// result can shadow the richer manually-curated row (BUG-02).
//
// This module is the ONE rule. It is pure (no DB, no DOM) so the planner API,
// the nearby-places API and client components can all share it.
import { haversineKm } from "@/lib/geo";

export interface DedupPlace {
  name: string;
  lat: number;
  lng: number;
}

// Lower number = more trustworthy source. When two rows collapse into one, the
// lower-priority number wins, so a hand-curated/admin-added place always beats
// a generic live-API point for the same spot (BUG-02: "manually added places
// and API places are being mixed incorrectly").
export const SOURCE_PRIORITY = {
  pinned: 0, // the traveller hand-picked this exact place
  destination: 1, // curated statewide catalogue (incl. admin-added)
  nearby: 2, // curated one-day-trip catalogue
  city: 3, // bulk-seeded city catalogue
  osm: 4, // live Overpass / Google-style API result
} as const;

export type PlaceSource = keyof typeof SOURCE_PRIORITY;

export function sourcePriority(source: string | undefined): number {
  return SOURCE_PRIORITY[(source ?? "osm") as PlaceSource] ?? SOURCE_PRIORITY.osm;
}

// ~110 m grid cell — two points in the same cell are the same place.
export function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokensOf(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  return a.size > 0 && [...a].every((t) => b.has(t));
}

// Words that mark "a different branch of the same-named chain" rather than
// "the same place with an extra descriptor" — "Orion Mall" and "Orion East
// Mall" are two real, distinct malls, so a directional/branch word blocks the
// merge even though it is textually just one extra token.
const BRANCH_QUALIFIERS = new Set([
  "east", "west", "north", "south", "new", "old", "main",
  "upper", "lower", "first", "second", "phase", "branch", "extension",
]);

// Honorifics and articles that carry no identity — one source writes "Sri
// Ranganathaswamy Temple", another "Ranganatha Swamy Temple", and they are the
// same shrine.
const HONORIFICS = new Set(["sri", "shri", "sree", "shree", "st", "saint", "the"]);

// The name with honorifics dropped and ALL spacing removed. Indian place names
// are written both as one word and as several ("Ranganathaswamy" /
// "Ranganatha Swamy"), which the token-set tests cannot see through: they
// compare word for word, so those two names share only the word "Temple" and
// score far too low to merge. Squashing to letters makes the pair identical.
function squashedKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t))
    .join("");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// True when `a` and `b` are the same real place catalogued twice.
export function isSamePlace(a: DedupPlace, b: DedupPlace): boolean {
  if (coordKey(a.lat, a.lng) === coordKey(b.lat, b.lng)) return true;
  const na = nameKey(a.name);
  const nb = nameKey(b.name);
  if (na && na === nb) return true;

  // Same name written with different spacing/honorifics — "Sri
  // Ranganathaswamy Temple" vs "Ranganatha Swamy Temple". Treated exactly like
  // an equal name above, since after removing spacing they ARE equal.
  const sa = squashedKey(a.name);
  const sb = squashedKey(b.name);
  if (sa && sa === sb) return true;

  const ta = tokensOf(a.name);
  const tb = tokensOf(b.name);
  const gapKm = haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
  const aSubB = isSubset(ta, tb);
  const bSubA = isSubset(tb, ta);

  const smaller = ta.size <= tb.size ? ta : tb;
  const larger = ta.size <= tb.size ? tb : ta;
  const extraTokens = [...larger].filter((t) => !smaller.has(t));
  // A branch/location word is what separates two real siblings from one place
  // named twice — "Orion Mall" and "Orion East Mall" are two different malls,
  // and they can stand a few hundred metres apart just as easily as a few
  // kilometres, so this guard applies at EVERY distance below, not only to the
  // wider test.
  const extraIsBranchQualifier = extraTokens.some((t) => BRANCH_QUALIFIERS.has(t));

  // Same complex mapped twice a few hundred metres apart, e.g. "ISKCON Temple"
  // and "ISKCON Temple Bangalore".
  if (gapKm <= 1.2 && (aSubB || bSubA) && !extraIsBranchQualifier) return true;

  // The same place entered independently in two source tables, whose
  // coordinates can sit several km apart because one source's entry is simply
  // imprecise — e.g. "Kurudumale Ganesha" vs "Kurudumale Ganesha Temple".
  // Guarded so it never fires on a single generic word ("Park") or on a real
  // sibling branch.
  if (
    gapKm <= 10 &&
    smaller.size >= 2 &&
    larger.size - smaller.size <= 1 &&
    (aSubB || bSubA) &&
    !extraIsBranchQualifier
  ) {
    return true;
  }

  // Near-identical names a short distance apart — the same place from two data
  // sources with slightly different spellings.
  if (gapKm <= 2 && jaccard(ta, tb) >= 0.7) return true;

  // One squashed name fully contains the other AND they're essentially in the
  // same spot — "Ranganathaswamy Temple" vs "Ranganathaswamy Temple Complex".
  // Held to ≤2 km and a 10-character floor so a short generic name can't
  // swallow an unrelated place that merely starts the same way.
  if (gapKm <= 2 && sa && sb) {
    const [shorter, longer] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
    if (shorter.length >= 10 && longer.includes(shorter)) return true;
  }

  return false;
}

// An incremental de-duplicator. Feed it candidates in ANY order; it keeps the
// best-sourced row for each real place and reports whether each candidate was
// taken. Callers that already know their preferred order can just ignore the
// `source` field — priority only breaks ties.
export class PlaceDeduper<T extends DedupPlace> {
  private kept: Array<{ item: T; priority: number }> = [];

  constructor(private readonly priorityOf: (item: T) => number = () => SOURCE_PRIORITY.osm) {}

  // Returns true when `item` was added as a NEW place. When it duplicates one
  // already held, the better-sourced of the two is kept and false is returned.
  add(item: T): boolean {
    const priority = this.priorityOf(item);
    for (let i = 0; i < this.kept.length; i++) {
      const held = this.kept[i];
      if (!isSamePlace(held.item, item)) continue;
      // Same place — keep whichever came from the more trustworthy source.
      if (priority < held.priority) this.kept[i] = { item, priority };
      return false;
    }
    this.kept.push({ item, priority });
    return true;
  }

  get items(): T[] {
    return this.kept.map((k) => k.item);
  }

  get size(): number {
    return this.kept.length;
  }
}

// One-shot helper for the common case: de-duplicate a list that is already in
// the caller's preferred order (best source first).
export function dedupePlaces<T extends DedupPlace>(
  items: T[],
  priorityOf: (item: T) => number = () => SOURCE_PRIORITY.osm
): T[] {
  const d = new PlaceDeduper<T>(priorityOf);
  for (const it of items) d.add(it);
  return d.items;
}

// Same thing for raw catalogue rows, whose coordinates are stored as strings.
// Rows with unusable coordinates are kept as-is (they can't be compared, and
// silently dropping a place would be worse than showing it once).
export function dedupeCatalogueRows<
  T extends { name: string; latitude: string | null; longitude: string | null }
>(rows: T[], priorityOf: (row: T) => number = () => SOURCE_PRIORITY.osm): T[] {
  const deduper = new PlaceDeduper<DedupPlace & { row: T }>((c) => priorityOf(c.row));
  const uncomparable: T[] = [];
  for (const row of rows) {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      uncomparable.push(row);
      continue;
    }
    deduper.add({ name: row.name, lat, lng, row });
  }
  return [...deduper.items.map((c) => c.row), ...uncomparable];
}
