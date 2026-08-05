// Pure time-math helpers for the Google-sourced weekly hours stored on
// destinations/city_places/nearby_destinations (see schema.ts's
// google* columns). No DB or network access here — safe to import from
// both server and client code, so the "is it open right now" status is
// always computed fresh at render time even though the underlying data is
// only as fresh as the last admin-triggered sync (src/lib/google-places.ts).

export interface DayHours {
  open: string; // "HH:MM", 24h
  close: string; // "HH:MM", 24h
  // True when this period runs past midnight into the next calendar day
  // (e.g. a bar open 18:00 -> 02:00). Absent/false = closes same day.
  closesNextDay?: boolean;
}

// Index 0 = Monday .. 6 = Sunday. Null = closed all day.
export type WeeklyHours = (DayHours | null)[];

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

  const todayHours = hours[today];
  const yesterdayHours = hours[yesterday];

  // Open via today's period (same-day, or the start of an overnight one).
  if (todayHours) {
    const openMin = toMinutes(todayHours.open);
    if (todayHours.closesNextDay) {
      if (nowMin >= openMin) {
        return { isOpen: true, changesAtLabel: `Closes at ${formatTime(todayHours.close)}` };
      }
    } else {
      const closeMin = toMinutes(todayHours.close);
      if (nowMin >= openMin && nowMin < closeMin) {
        return { isOpen: true, changesAtLabel: `Closes at ${formatTime(todayHours.close)}` };
      }
    }
  }
  // Open via yesterday's overnight period still running into today.
  if (yesterdayHours?.closesNextDay) {
    const closeMin = toMinutes(yesterdayHours.close);
    if (nowMin < closeMin) {
      return { isOpen: true, changesAtLabel: `Closes at ${formatTime(yesterdayHours.close)}` };
    }
  }

  // Closed — find the next opening, scanning today (later) then forward up
  // to 6 more days.
  for (let offset = 0; offset <= 6; offset++) {
    const dayIdx = (today + offset) % 7;
    const day = hours[dayIdx];
    if (!day) continue;
    const openMin = toMinutes(day.open);
    if (offset === 0 && openMin <= nowMin) continue; // already passed today's opening
    const label = offset === 0 ? `Closed until ${formatTime(day.open)}` : `Closed until ${DAY_LABELS[dayIdx]} ${formatTime(day.open)}`;
    return { isOpen: false, changesAtLabel: label };
  }
  // No opening found in the next 7 days (genuinely closed every day of the week).
  return { isOpen: false, changesAtLabel: "Closed" };
}

// Monday-first list for a full weekly hours table, e.g. for detail pages.
export function formatWeeklyHours(hours: WeeklyHours): { day: string; label: string }[] {
  return DAY_LABELS.map((day, i) => {
    const d = hours[i];
    return { day, label: d ? `${formatTime(d.open)} – ${formatTime(d.close)}` : "Closed" };
  });
}
