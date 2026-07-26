import { CalendarClock, MapPin, Sparkles, Clock } from "lucide-react";

import { AddToCartButton } from "@/components/app/AddToCartButton";
import { formatFestivalDate, daysUntil, type FestivalOccurrence } from "@/lib/festivals";
import { Reveal } from "@/components/app/Reveal";
import { RevealGrid } from "@/components/app/RevealGrid";

const festSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Splits an ISO date into a stacked day/month badge. Falls back to the label.
function dateBadge(iso: string | null, label: string): { day: string; month: string } {
  if (!iso) return { day: label.slice(0, 3), month: "" };
  const [, m, d] = iso.split("-").map(Number);
  return { day: String(d).padStart(2, "0"), month: (MONTHS[m - 1] ?? "").toUpperCase() };
}

// Short countdown copy for a festival, or null once it has passed.
function countdown(iso: string | null): string | null {
  const d = daysUntil(iso);
  if (d == null || d < 0) return null;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 30) return `In ${d} days`;
  const w = Math.round(d / 7);
  return `In ${w} weeks`;
}

interface Props {
  festivals: FestivalOccurrence[];
  nextUpcomingName: string | null;
}

// A bespoke, app-first mobile festivals screen — distinct from the desktop grid.
// Rendered only below `lg`. Coral accent comes automatically from the mobile
// theme, so all `emerald` utilities here paint coral on phones.
export function MobileFestivals({ festivals, nextUpcomingName }: Props) {
  // "This month" rail = the nearest upcoming festivals (nearest first).
  const thisMonth = festivals
    .filter((f) => {
      const d = daysUntil(f.nextISO);
      return d != null && d >= 0;
    })
    .slice(0, 8);

  return (
    <div className="space-y-6 pb-4">
      {/* Bold header */}
      <Reveal as="header" amount={0}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
            <CalendarClock className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-500">Plan around the celebrations</p>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900">
              Festivals &amp; Events
            </h1>
          </div>
        </div>
      </Reveal>

      {/* This month rail */}
      {thisMonth.length > 0 && (
        <Reveal as="section" amount={0}>
          <div className="mb-3 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Coming up next</h2>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
            {thisMonth.map((f) => {
              const badge = dateBadge(f.nextISO, f.dateLabel);
              const cd = countdown(f.nextISO);
              const isNext = nextUpcomingName === f.name;
              return (
                <div
                  key={f.name}
                  className={`relative flex w-40 shrink-0 flex-col justify-between overflow-hidden rounded-3xl border bg-white p-4 shadow-sm active:scale-[0.98] ${
                    isNext ? "border-emerald-300 ring-2 ring-emerald-200" : "border-slate-200"
                  }`}
                >
                  {isNext && (
                    <span aria-hidden className="sheen-overlay animate-sheen" />
                  )}
                  <div className="flex items-start justify-between">
                    <span className="text-4xl drop-shadow-sm">{f.emoji}</span>
                    <div className="text-right leading-none">
                      <p className="text-xl font-extrabold text-slate-900">{badge.day}</p>
                      <p className="text-[10px] font-bold tracking-wider text-slate-400">{badge.month}</p>
                    </div>
                  </div>
                  <div className="mt-3 min-w-0">
                    <p className="truncate text-sm font-extrabold tracking-tight text-slate-900">{f.name}</p>
                    {cd && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <Clock className="h-2.5 w-2.5" /> {cd}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* Full festival list — large cards */}
      <Reveal as="section" amount={0}>
        <h2 className="mb-3 text-lg font-extrabold tracking-tight text-slate-900">All festivals</h2>
        <RevealGrid className="space-y-4">
          {festivals.map((f) => {
            const badge = dateBadge(f.nextISO, f.dateLabel);
            const cd = countdown(f.nextISO);
            const isNext = nextUpcomingName === f.name;
            return (
              <Reveal
                key={f.name}
                className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
                  isNext ? "border-emerald-300 ring-2 ring-emerald-200" : "border-slate-200"
                }`}
              >
                {/* Imagery banner with stacked date badge */}
                <div className="relative flex items-center gap-4 border-b border-emerald-100/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
                  <span className="text-5xl drop-shadow-sm">{f.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold leading-tight tracking-tight text-slate-900">
                      {f.name}
                    </p>
                    {f.hub && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{f.hub}</span>
                      </p>
                    )}
                  </div>
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-center leading-none shadow-sm ring-1 ring-slate-200">
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">{badge.day}</p>
                      <p className="text-[9px] font-bold tracking-wider text-slate-400">{badge.month}</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {formatFestivalDate(f.nextISO) || f.dateLabel}
                    </span>
                    {cd && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        <Clock className="h-3 w-3" /> {cd}
                      </span>
                    )}
                    {isNext && (
                      <span className="rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-md shadow-emerald-500/40">
                        Up next
                      </span>
                    )}
                  </div>

                  {f.significance && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">{f.significance}</p>
                  )}

                  <div className="mt-4">
                    <AddToCartButton
                      className="w-full"
                      label="Plan a trip"
                      item={{
                        id: `festival-${festSlug(f.name)}`,
                        name: f.name,
                        subtitle: [f.hub, formatFestivalDate(f.nextISO)].filter(Boolean).join(" · "),
                        kind: "festival",
                        emoji: f.emoji,
                        href: "/festivals",
                      }}
                    />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </RevealGrid>
      </Reveal>
    </div>
  );
}
