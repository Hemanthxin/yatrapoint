// Pure time-math helpers for the Google-sourced weekly hours stored on
// destinations/city_places/nearby_destinations (see schema.ts's
// google* columns). No DB or network access here — safe to import from
// both server and client code, so the "is it open right now" status is
// always computed fresh at render time even though the underlying data is
// only as fresh as the last admin-triggered sync (src/lib/google-places.ts).

export interface DayPeriod {
  open: string; // "HH:MM", 24h
  close: string; // "HH:MM", 24h
  // True when this period runs past midnight into the next calendar day
  // (e.g. a bar open 18:00 -> 02:00). Absent/false = closes same day.
  closesNextDay?: boolean;
}

// Index 0 = Monday .. 6 = Sunday. Each day can have MULTIPLE periods — many
// temples (and some shops) close midday and reopen in the evening, e.g.
// "4:00 AM - 1:00 PM, 3:00 PM - 8:00 PM". Null = closed all day.
export type WeeklyHours = (DayPeriod[] | null)[];

// Places synced before multi-period support stored a single DayPeriod
// object per day instead of an array — normalize that legacy shape here so
// old data (rather than being re-synced) keeps working, just without a
// second window.
type LegacyWeeklyHours = (DayPeriod | DayPeriod[] | null)[];
export function normalizeWeeklyHours(raw: LegacyWeeklyHours | null | undefined): WeeklyHours | null {
  if (!raw) return null;
  return raw.map((d) => {
    if (!d) return null;
    return Array.isArray(d) ? d : [d];
  });
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Every place in this app is in Karnataka/India — there's no per-place
// timezone anywhere in the codebase, so IST is assumed everywhere, same as
// the rest of the app. Vercel functions run in UTC, so this must be
// computed explicitly rather than relying on server-local time.
// Exported so callers (e.g. the weekly-hours table UI) can highlight
// today's row without duplicating the IST day-of-week calculation.
export function todayMondayIndexIST(now: Date = new Date()): number {
  return nowInIST(now).mondayIndex;
}

function nowInIST(date: Date): { mondayIndex: number; minutesSinceMidnight: number } {
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const jsDay = shifted.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const mondayIndex = (jsDay + 6) % 7; // 0 = Monday .. 6 = Sunday
  const minutesSinceMidnight = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return { mondayIndex, minutesSinceMidnight };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export interface OpenStatus {
  isOpen: boolean;
  // "Closes at 10:00 PM" / "Closed until Thu 10:30 AM" — mirrors the
  // "Closed until Thu 10:30 AM" phrasing from Google Maps.
  changesAtLabel: string;
}

// Returns null when hours is missing/empty (place hasn't been synced yet,
// or Google returned no structured hours) — callers should hide the badge
// entirely rather than show a guess.
export function computeOpenStatus(hours: WeeklyHours | null | undefined, now: Date = new Date()): OpenStatus | null {
  if (!hours || hours.length !== 7 || hours.every((d) => d == null)) return null;

  const { mondayIndex: today, minutesSinceMidnight: nowMin } = nowInIST(now);
  const yesterday = (today + 6) % 7;

  const todayPeriods = hours[today] ?? [];
  const yesterdayPeriods = hours[yesterday] ?? [];

  // Open via any of today's periods (same-day, or the start of an overnight one).
  for (const period of todayPeriods) {
    const openMin = toMinutes(period.open);
    if (period.closesNextDay) {
      if (nowMin >= openMin) {
        return { isOpen: true, changesAtLabel: `Closes at ${formatTime(period.close)}` };
      }
    } else {
      const closeMin = toMinutes(period.close);
      if (nowMin >= openMin && nowMin < closeMin) {
        return { isOpen: true, changesAtLabel: `Closes at ${formatTime(period.close)}` };
      }
    }
  }
  // Open via yesterday's overnight period(s) still running into today.
  for (const period of yesterdayPeriods) {
    if (!period.closesNextDay) continue;
    const closeMin = toMinutes(period.close);
    if (nowMin < closeMin) {
      return { isOpen: true, changesAtLabel: `Closes at ${formatTime(period.close)}` };
    }
  }

  // Closed — first check for a LATER period today (e.g. it's 2pm and the
  // place reopens at 3pm after a midday close).
  const laterToday = todayPeriods
    .filter((p) => toMinutes(p.open) > nowMin)
    .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];
  if (laterToday) {
    return { isOpen: false, changesAtLabel: `Closed until ${formatTime(laterToday.open)}` };
  }
  // Otherwise scan forward up to 6 more days for the next opening.
  for (let offset = 1; offset <= 6; offset++) {
    const dayIdx = (today + offset) % 7;
    const periods = hours[dayIdx];
    if (!periods || periods.length === 0) continue;
    const earliest = [...periods].sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];
    return { isOpen: false, changesAtLabel: `Closed until ${DAY_LABELS[dayIdx]} ${formatTime(earliest.open)}` };
  }
  // No opening found in the next 7 days (genuinely closed every day of the week).
  return { isOpen: false, changesAtLabel: "Closed" };
}

// Monday-first list for a full weekly hours table, e.g. for detail pages.
// Multiple periods in a day are joined "4:00 AM – 1:00 PM, 3:00 PM – 8:00 PM".
export function formatWeeklyHours(hours: WeeklyHours): { day: string; label: string }[] {
  return DAY_LABELS.map((day, i) => {
    const periods = hours[i];
    const label =
      periods && periods.length > 0
        ? periods.map((p) => `${formatTime(p.open)} – ${formatTime(p.close)}`).join(", ")
        : "Closed";
    return { day, label };
  });
}
