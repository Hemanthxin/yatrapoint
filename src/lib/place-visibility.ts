// Saafera's single rule for whether a place should be shown.
//
// BUG-01: permanently-closed places were appearing everywhere, because nothing
// in the app ever knew they were closed — the Google sync only asked for
// rating + opening hours, never `businessStatus`. Now the sync stores it (see
// src/lib/google-places.ts) and EVERY list applies this one rule so a place
// that Google says is gone can't come back through a different screen.
//
// Pure module: no DB, no DOM — safe on the server and in client components.

export type BusinessStatus =
  | "OPERATIONAL"
  | "CLOSED_TEMPORARILY"
  | "CLOSED_PERMANENTLY";

export interface HasBusinessStatus {
  googleBusinessStatus?: string | null;
}

// Permanently gone. Null/unknown is deliberately NOT closed: most of the
// catalogue has never been synced, and treating "unknown" as closed would
// empty every page.
export function isPermanentlyClosed(place: HasBusinessStatus): boolean {
  return (place.googleBusinessStatus ?? "").toUpperCase() === "CLOSED_PERMANENTLY";
}

// Shut right now but expected to reopen (renovation, seasonal). Still worth
// showing — with a badge — so a traveller isn't surprised on arrival.
export function isTemporarilyClosed(place: HasBusinessStatus): boolean {
  return (place.googleBusinessStatus ?? "").toUpperCase() === "CLOSED_TEMPORARILY";
}

// The visibility rule the QA checklist asks for ("Closed places follow
// Saafera's defined visibility rule"): permanently-closed places are hidden
// from every list, plan and search result; temporarily-closed ones stay
// visible and are badged.
export function isVisiblePlace(place: HasBusinessStatus): boolean {
  return !isPermanentlyClosed(place);
}

export function filterVisiblePlaces<T extends HasBusinessStatus>(places: T[]): T[] {
  return places.filter(isVisiblePlace);
}
