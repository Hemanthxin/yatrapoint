import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, MapPin, ArrowRight } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { FESTIVALS, formatFestivalDate, daysUntil } from "@/lib/festivals";

export default async function FestivalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  // Next upcoming festival gets a highlighted badge.
  const nextUpcoming = FESTIVALS.find((f) => {
    const d = daysUntil(f.dateISO);
    return d != null && d >= 0;
  });

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Festivals &amp; Events <span className="text-lg font-bold text-slate-400">2026</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Major Indian festivals through the year — plan a trip around them.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FESTIVALS.map((f, i) => {
          const d = daysUntil(f.dateISO);
          const isNext = nextUpcoming?.name === f.name;
          return (
            <div
              key={f.name}
              style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
              className={`card-hover animate-fadeUp flex flex-col overflow-hidden rounded-3xl border bg-white ${
                isNext ? "border-orange-300 ring-2 ring-orange-200" : "border-slate-200"
              }`}
            >
              <div className="relative flex items-center justify-between bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-4">
                <span className="text-4xl drop-shadow-sm sm:text-5xl">{f.emoji}</span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-orange-700 backdrop-blur">
                  {formatFestivalDate(f.dateISO)}
                </span>
                {isNext && (
                  <span className="absolute -bottom-2 left-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                    Up next{d != null && d >= 0 ? ` · ${d === 0 ? "today" : d === 1 ? "tomorrow" : `${d} days`}` : ""}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-extrabold tracking-tight text-slate-900">{f.name}</p>
                {f.hub && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{f.hub}</span>
                  </p>
                )}
                {f.significance && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.significance}</p>
                )}
                <Link
                  href="/budget-planner"
                  className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-emerald-600 hover:gap-2.5 hover:text-emerald-700"
                >
                  Plan a trip <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </AppShell>
  );
}
