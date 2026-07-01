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
