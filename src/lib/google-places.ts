// Google Places API (New) — server-only (the API key must never reach the
// client), used exclusively by the admin-triggered batch sync (see
// src/lib/actions/admin-place-sync.ts), never on a live page view. Mirrors
// src/lib/google-distance.ts's shape: reads GOOGLE_MAPS_API_KEY, returns
// null on any failure so the sync can skip a place and move on rather than
// crash the whole batch.
import type { WeeklyHours, DayHours } from "./place-hours";

const PLACES_BASE = "https://places.googleapis.com/v1";

// Resolves a place's Google Place ID via Text Search, biased toward its
// known coordinates so a common name (e.g. "Central Mall") disambiguates
// to the right branch instead of a same-named place elsewhere in India.
export async function findGooglePlaceId(
  name: string,
  lat: number,
  lng: number
): Promise<string | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify({
        textQuery: name,
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 10000 },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: { id?: string }[] };
    return data.places?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export interface GooglePlaceStatus {
  rating: number | null;
  ratingCount: number | null;
  weeklyHours: WeeklyHours | null;
}

interface GoogleOpeningHoursPeriod {
  open?: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

// Google's period.day is 0=Sunday..6=Saturday; this app's WeeklyHours is
// 0=Monday..6=Sunday (matches how the rest of the codebase already talks
// about days — see the Mon-Sat/Tue-Sun style openDays strings on
// city_places). Converts between the two.
function googleDayToMondayIndex(googleDay: number): number {
  return (googleDay + 6) % 7;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseWeeklyHours(periods: GoogleOpeningHoursPeriod[] | undefined): WeeklyHours | null {
  if (!periods || periods.length === 0) return null;
  const hours: WeeklyHours = Array(7).fill(null);
  for (const period of periods) {
    if (!period.open) continue;
    const dayIdx = googleDayToMondayIndex(period.open.day);
    // A day with multiple periods (split lunch/dinner hours) can't be
    // represented by this app's one-range-per-day model (same limitation
    // the existing simple openTime/closeTime fields already have) — first
    // period for a day wins, rest are dropped.
    if (hours[dayIdx]) continue;
    const openStr = `${pad2(period.open.hour)}:${pad2(period.open.minute)}`;
    if (!period.close) {
      // No close time at all = open 24h that day.
      hours[dayIdx] = { open: openStr, close: "23:59" };
      continue;
    }
    const closeStr = `${pad2(period.close.hour)}:${pad2(period.close.minute)}`;
    const entry: DayHours = { open: openStr, close: closeStr };
    if (period.close.day !== period.open.day) entry.closesNextDay = true;
    hours[dayIdx] = entry;
  }
  return hours.every((d) => d == null) ? null : hours;
}

// Field mask deliberately restricted to just rating/count/hours — no
// photos/reviews/contact fields, to keep each call as cheap as possible.
export async function fetchGooglePlaceStatus(placeId: string): Promise<GooglePlaceStatus | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "rating,userRatingCount,regularOpeningHours",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      rating?: number;
      userRatingCount?: number;
      regularOpeningHours?: { periods?: GoogleOpeningHoursPeriod[] };
    };
    return {
      rating: data.rating ?? null,
      ratingCount: data.userRatingCount ?? null,
      weeklyHours: parseWeeklyHours(data.regularOpeningHours?.periods),
    };
  } catch {
    return null;
  }
}
