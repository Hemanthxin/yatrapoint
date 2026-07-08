import Link from "next/link";
import { MapPin } from "lucide-react";
import type { UpcomingTrip } from "@/lib/queries/trip-plans";

// A trip whose status isn't "draft" counts as Confirmed; drafts are Pending.
function badge(status: string): { label: string; cls: string } {
  return status && status !== "draft"
    ? { label: "Confirmed", cls: "bg-emerald-100 text-emerald-700" }
    : { label: "Pending", cls: "bg-amber-100 text-amber-700" };
}

// "24 May – 26 May" style range derived from the plan's creation date + length,
// since plans don't store an explicit start date.
function dateRange(start: Date, days: number): string {
  const end = new Date(start.getTime() + Math.max(0, days - 1) * 86_400_000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return days > 1 ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export function UpcomingTrips({ trips }: { trips: UpcomingTrip[] }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">Upcoming Trips</p>
        <Link href="/profile" className="text-xs font-bold text-emerald-700 hover:underline">
          View all →
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-center">
          <p className="text-sm font-semibold text-slate-600">No trips yet</p>
          <p className="mt-0.5 text-xs text-slate-400">Plan one and it’ll show up here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((t) => {
            const b = badge(t.status);
            return (
              <li key={t.id} className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                  <MapPin className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{t.name}</p>
                  <p className="text-[11px] text-slate-500">{dateRange(t.createdAt, t.days)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${b.cls}`}>
                  {b.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
