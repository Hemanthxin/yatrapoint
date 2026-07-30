import { redirect } from "next/navigation";
import { CalendarClock, MapPin } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { AddToCartButton } from "@/components/app/AddToCartButton";
import { festivalsByNextOccurrence, festivalSlug, formatFestivalDate, daysUntil } from "@/lib/festivals";
import { getFestivalImages } from "@/lib/actions/festival-images";
import { MobileFestivals } from "./MobileFestivals";
import { Reveal } from "@/components/app/Reveal";
import { RevealGrid } from "@/components/app/RevealGrid";
import { PulseBadge } from "@/components/app/PulseBadge";
import { PageHero } from "@/components/app/PageHero";

const festSlug = festivalSlug;

export default async function FestivalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  // Ordered by next occurrence — upcoming festivals first (nearest first),
  // anything already finished this year rolls to the end with next year's date.
  const FESTIVALS = festivalsByNextOccurrence();
  const festivalImages = await getFestivalImages();
  // The very first one is always the next upcoming festival.
  const nextUpcoming = FESTIVALS[0] ?? null;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      {/* ── Mobile (< lg): bespoke app UI ── */}
      <div className="lg:hidden">
        <MobileFestivals
          festivals={FESTIVALS}
          nextUpcomingName={nextUpcoming?.name ?? null}
          images={festivalImages}
        />
      </div>

      {/* ── Desktop (≥ lg): the original festivals page, unchanged ── */}
      <div className="hidden lg:block">
      <Reveal amount={0}>
      <PageHero
        eyebrow="The year ahead"
        icon={CalendarClock}
        title={<>Festivals <span className="italic">&amp; Events</span></>}
        subtitle="Major Indian festivals through the year — plan a trip around them."
        gradient="from-amber-600 via-orange-600 to-rose-600"
        backgroundImage="/festivals-hero-bg.jpg"
      />

      <RevealGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {FESTIVALS.map((f) => {
          const d = daysUntil(f.nextISO);
          const isNext = nextUpcoming?.name === f.name;
          const image = festivalImages[festSlug(f.name)];
          return (
            <Reveal
              key={f.name}
              direction="flip"
              className={`card-hover flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm ${
                isNext ? "border-emerald-300 ring-2 ring-emerald-200" : "border-slate-200"
              }`}
            >
              <div className="relative flex h-32 items-center justify-between overflow-hidden border-b border-emerald-100/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={f.name} className="absolute inset-0 h-full w-full object-cover" />
                )}
                {image && <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />}
                <span className={`relative text-4xl drop-shadow-sm sm:text-5xl ${image ? "drop-shadow-lg" : ""}`}>
                  {image ? "" : f.emoji}
                </span>
                <span
                  className={`relative rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                    image
                      ? "bg-white/90 text-slate-700 ring-white/40 backdrop-blur"
                      : "bg-white text-slate-600 ring-slate-200"
                  }`}
                >
                  {formatFestivalDate(f.nextISO)}
                </span>
                {isNext && (
                  <PulseBadge className="absolute -bottom-2 left-4 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md shadow-emerald-500/40">
                    Up next{d != null && d >= 0 ? ` · ${d === 0 ? "today" : d === 1 ? "tomorrow" : `${d} days`}` : ""}
                  </PulseBadge>
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
