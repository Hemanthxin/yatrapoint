import data from "@/lib/db/data/festivals.json";

export interface Festival {
  name: string;
  hub: string | null;
  dateISO: string | null;
  dateLabel: string;
  significance: string | null;
  emoji: string;
}

export const FESTIVALS: Festival[] = (data as Festival[])
  .slice()
  .sort((a, b) => (a.dateISO || "9999").localeCompare(b.dateISO || "9999"));

// Stable, URL/key-safe identifier for a festival — festival names have no id
// of their own (they live in a static JSON file), so this doubles as both the
// cart item id and the admin-uploaded image lookup key.
export function festivalSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Festivals from `today` onwards, nearest first. Once a festival's date passes
// it drops off, so the list always leads with the next upcoming festival. If
// every festival is in the past (e.g. late in the year), fall back to the full
// list so the ticker never goes empty.
export function upcomingFestivals(todayISO?: string): Festival[] {
  const today = todayISO ?? new Date().toISOString().slice(0, 10);
  const dated = FESTIVALS.filter((f) => f.dateISO);
  const upcoming = dated.filter((f) => (f.dateISO as string) >= today);
  return upcoming.length ? upcoming : dated;
}

// The next annual occurrence of a festival relative to `today`. Festivals repeat
// every year, so once this year's date has passed we roll it forward to the same
// day next year — that's why a just-finished festival re-appears with next
// year's date instead of vanishing or staying stuck at the top of the list.
// (Approximate for lunar-calendar festivals, whose exact day shifts each year.)
export function nextOccurrenceISO(iso: string | null, todayISO?: string): string | null {
  if (!iso) return null;
  const today = todayISO ?? new Date().toISOString().slice(0, 10);
  const [, mm, dd] = iso.split("-");
  let year = Number(today.slice(0, 4));
  let candidate = `${year}-${mm}-${dd}`;
  if (candidate < today) {
    year += 1;
    candidate = `${year}-${mm}-${dd}`;
  }
  return candidate;
}

// A festival plus its next upcoming occurrence date.
export interface FestivalOccurrence extends Festival {
  nextISO: string | null;
}

// Every festival ordered by its NEXT occurrence — so still-upcoming festivals
// come first (nearest first) and any that already finished this year fall to the
// end carrying next year's date.
export function festivalsByNextOccurrence(
  todayISO?: string,
  // Community-suggested festivals that an admin has approved (BUG-10). They
  // sort by date alongside the built-in ones rather than sitting in a separate
  // second-class list — a local jatre next week matters more to a traveller
  // than a national festival six months out.
  extra: Festival[] = []
): FestivalOccurrence[] {
  const today = todayISO ?? new Date().toISOString().slice(0, 10);
  // A community submission for a festival already in the built-in list would
  // otherwise show twice.
  const builtInNames = new Set(FESTIVALS.map((f) => festivalSlug(f.name)));
  const merged = [...FESTIVALS, ...extra.filter((f) => !builtInNames.has(festivalSlug(f.name)))];
  return merged
    .map((f) => ({ ...f, nextISO: nextOccurrenceISO(f.dateISO, today) }))
    .sort((a, b) => (a.nextISO || "9999").localeCompare(b.nextISO || "9999"));
}

// Human date like "8 Nov 2026" from an ISO string.
export function formatFestivalDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

// Days until a festival (negative if past).
export function daysUntil(iso: string | null, todayISO?: string): number | null {
  if (!iso) return null;
  const today = todayISO ?? new Date().toISOString().slice(0, 10);
  const a = Date.parse(iso + "T00:00:00Z");
  const b = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}
