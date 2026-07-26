import { redirect } from "next/navigation";
import { CalendarClock, MapPin } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { AddToCartButton } from "@/components/app/AddToCartButton";
import { festivalsByNextOccurrence, formatFestivalDate, daysUntil } from "@/lib/festivals";
import { MobileFestivals } from "./MobileFestivals";
import { Reveal } from "@/components/app/Reveal";
import { RevealGrid } from "@/components/app/RevealGrid";

const festSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default async function FestivalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  // Ordered by next occurrence — upcoming festivals first (nearest first),
  // anything already finished this year rolls to the end with next year's date.
  const FESTIVALS = festivalsByNextOccurrence();
  // The very first one is always the next upcoming festival.
  const nextUpcoming = FESTIVALS[0] ?? null;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      {/* ── Mobile (< lg): bespoke app UI ── */}
      <div className="lg:hidden">
        <MobileFestivals festivals={FESTIVALS} nextUpcomingName={nextUpcoming?.name ?? null} />
      </div>

      {/* ── Desktop (≥ lg): the original festivals page, unchanged ── */}
      <div className="hidden lg:block">
      <Reveal amount={0}>
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            <span className="text-gradient">Festivals &amp; Events</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Major Indian festivals through the year — plan a trip around them.
          </p>
        </div>
      </header>

      <RevealGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {FESTIVALS.map((f) => {
          const d = daysUntil(f.nextISO);
          const isNext = nextUpcoming?.name === f.name;
          return (
            <Reveal
              key={f.name}
              className={`card-hover flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm ${
                isNext ? "border-emerald-300 ring-2 ring-emerald-200" : "border-slate-200"
              }`}
            >
              <div className="relative flex items-center justify-between border-b border-emerald-100/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
                <span className="text-4xl drop-shadow-sm sm:text-5xl">{f.emoji}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                  {formatFestivalDate(f.nextISO)}
                </span>
                {isNext && (
                  <span className="absolute -bottom-2 left-4 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md shadow-emerald-500/40">
                    Up next{d != null && d >= 0 ? ` · ${d === 0 ? "today" : d === 1 ? "tomorrow" : `${d} days`}` : ""}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col p-4">
                <p className="text-base font-extrabold tracking-tight text-slate-900">{f.name}</p>
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
    </AppShell>
  );
}
