import { Star, Clock } from "lucide-react";
import { computeOpenStatus, formatWeeklyHours, todayMondayIndexIST, type WeeklyHours } from "@/lib/place-hours";

function parseWeeklyHours(json: string | null | undefined): WeeklyHours | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as WeeklyHours) : null;
  } catch {
    return null;
  }
}

export interface PlaceStatusBadgesProps {
  rating: number | null | undefined;
  ratingCount: number | null | undefined;
  weeklyHoursJson: string | null | undefined;
  className?: string;
}

// Small inline row for list cards — star rating + Open/Closed pill. Renders
// nothing when the place hasn't been synced yet (every place starts
// unsynced — see /admin/place-sync), so cards look exactly as they did
// before this feature until an admin runs a sync.
export function PlaceStatusBadgesCompact({ rating, ratingCount, weeklyHoursJson, className = "" }: PlaceStatusBadgesProps) {
  const status = computeOpenStatus(parseWeeklyHours(weeklyHoursJson));
  if (rating == null && !status) return null;

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {rating != null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {rating.toFixed(1)}
          {ratingCount != null && <span className="font-medium text-amber-600">({ratingCount})</span>}
        </span>
      )}
      {status && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            status.isOpen ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
          }`}
        >
          {status.isOpen ? "Open now" : "Closed"}
        </span>
      )}
    </div>
  );
}

// Full block for detail pages — rating + review count, Open/Closed with
// "closes at" / "opens at" detail, and the full Monday-Sunday hours table
// with today's row highlighted.
export function PlaceStatusBadgesFull({ rating, ratingCount, weeklyHoursJson, className = "" }: PlaceStatusBadgesProps) {
  const weeklyHours = parseWeeklyHours(weeklyHoursJson);
  const status = computeOpenStatus(weeklyHours);
  if (rating == null && !status) return null;

  const todayIdx = todayMondayIndexIST();
  const rows = weeklyHours ? formatWeeklyHours(weeklyHours) : null;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        {rating != null && (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {rating.toFixed(1)}
            {ratingCount != null && <span className="font-medium text-slate-500">({ratingCount} reviews)</span>}
          </span>
        )}
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
              status.isOpen ? "text-emerald-700" : "text-rose-600"
            }`}
          >
            <Clock className="h-4 w-4" />
            {status.isOpen ? "Open now" : "Closed"} · {status.changesAtLabel}
          </span>
        )}
      </div>
      {rows && (
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 border-t border-slate-200 pt-3 text-xs sm:grid-cols-2">
          {rows.map((r, i) => (
            <div
              key={r.day}
              className={`flex items-center justify-between ${i === todayIdx ? "font-bold text-slate-900" : "text-slate-500"}`}
            >
              <span>{r.day}</span>
              <span>{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
