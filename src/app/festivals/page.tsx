import { redirect } from "next/navigation";
import { CalendarClock, MapPin } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { AddToCartButton } from "@/components/app/AddToCartButton";
import { FESTIVALS, formatFestivalDate, daysUntil } from "@/lib/festivals";

const festSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Festivals &amp; Events <span className="text-lg font-semibold text-slate-400">2026</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Major Indian festivals through the year — plan a trip around them.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FESTIVALS.map((f, i) => {
          const d = daysUntil(f.dateISO);
          const isNext = nextUpcoming?.name === f.name;
          return (
            <div
              key={f.name}
              style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
              className={`card-hover animate-fadeUp flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${
                isNext ? "border-emerald-300 ring-1 ring-emerald-100" : "border-slate-200"
              }`}
            >
              <div className="relative flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
                <span className="text-4xl sm:text-5xl">{f.emoji}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {formatFestivalDate(f.dateISO)}
                </span>
                {isNext && (
                  <span className="absolute -bottom-2 left-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                    Up next{d != null && d >= 0 ? ` · ${d === 0 ? "today" : d === 1 ? "tomorrow" : `${d} days`}` : ""}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col p-4">
                <p className="font-semibold tracking-tight text-slate-900">{f.name}</p>
                {f.hub && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{f.hub}</span>
                  </p>
                )}
                {f.significance && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.significance}</p>
                )}
                <div className="mt-auto pt-4">
                  <AddToCartButton
                    className="w-full"
                    label="Plan a trip"
                    item={{
                      id: `festival-${festSlug(f.name)}`,
                      name: f.name,
                      subtitle: [f.hub, formatFestivalDate(f.dateISO)].filter(Boolean).join(" · "),
                      kind: "festival",
                      emoji: f.emoji,
                      href: "/festivals",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </AppShell>
  );
}
