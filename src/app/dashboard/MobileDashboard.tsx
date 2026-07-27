"use client";

import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  Wallet,
  CalendarClock,
  Users,
  Sparkles,
} from "lucide-react";

import { formatINR } from "@/lib/format";
import { CATEGORIES, CATEGORY_BY_SLUG, CATEGORY_GRADIENT, type CategorySlug } from "@/lib/catalog/categories";
import { PlaceImage } from "@/components/app/PlaceImage";
import { WeatherCard } from "@/components/app/dashboard/WeatherCard";
import { NearbyPlaces } from "@/components/app/dashboard/NearbyPlaces";
import type { CityPlace, Destination } from "@/lib/db/schema";
import { Reveal } from "@/components/app/Reveal";
import { AnimatedWords } from "@/components/app/AnimatedWords";
import { CountUp } from "@/components/app/CountUp";

interface Props {
  firstName: string;
  stats: { tripsPlanned: number; placesExplored: number; totalSaved: number };
  citySeed: CityPlace[];
  popularTrips: Destination[];
}

// A bespoke, app-first mobile home — completely distinct from the desktop grid.
// Rendered only below `lg`. Coral accent comes automatically from the mobile
// theme, so all `emerald` utilities here paint coral on phones.
export function MobileDashboard({ firstName, stats, citySeed, popularTrips }: Props) {
  const featured = popularTrips[0];
  const featuredCat = featured ? CATEGORY_BY_SLUG[featured.category as CategorySlug] : undefined;

  return (
    <div className="space-y-6 pb-4">
      {/* Greeting (search lives in the top bar) */}
      <Reveal amount={0}>
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-[color:var(--highlight)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--highlight)]" />
          Namaste 🙏
        </p>
        <AnimatedWords
          as="h1"
          text={`Hey ${firstName}`}
          className="text-3xl font-black tracking-tight text-slate-900"
        />
        <p className="mt-0.5 text-[13px] font-medium text-slate-500">Where are we headed today?</p>
      </Reveal>

      {/* Live weather for the traveller's location */}
      <Reveal amount={0}>
        <WeatherCard />
      </Reveal>

      {/* Category quick-access circles */}
      <Reveal amount={0}>
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/destinations?category=${c.slug}`}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5 active:scale-95"
            >
              <span
                className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${
                  CATEGORY_GRADIENT[c.slug as CategorySlug]
                } text-3xl shadow-lg shadow-emerald-500/10`}
              >
                {c.emoji}
              </span>
              <span className="truncate text-[11px] font-semibold text-slate-600">{c.label}</span>
            </Link>
          ))}
        </div>
      </Reveal>

      {/* Featured hero card */}
      {featured && (
        <Link
          href={`/destinations/${featured.slug}`}
          className="animate-fadeUp relative block h-56 overflow-hidden rounded-3xl shadow-xl shadow-emerald-500/10"
        >
          <PlaceImage
            name={featured.name}
            storedSrc={featured.imageUrl}
            hint={[featured.district, featured.state].filter(Boolean).join(", ")}
            category={featured.category}
            emoji={featuredCat?.emoji ?? "📍"}
            gradient={CATEGORY_GRADIENT[featured.category as CategorySlug] ?? "from-sky-400 to-emerald-500"}
            className="absolute inset-0 h-full w-full"
            emojiClassName="text-6xl"
            preferWiki
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-700 backdrop-blur">
            <Sparkles className="h-3 w-3 text-emerald-600" /> Featured
          </span>
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/80">
              {featuredCat?.label ?? featured.category}
            </p>
            <h2 className="mt-0.5 text-2xl font-extrabold leading-tight drop-shadow">{featured.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-white/85">
              <MapPin className="h-3 w-3" /> {featured.district ? `${featured.district}, ` : ""}
              {featured.state}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 text-xs font-bold shadow-lg shadow-emerald-500/40">
              Plan this trip <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction href="/budget-planner" icon={<Wallet className="h-5 w-5" />} title="Trip Planner" sub="Plan within budget" />
        <QuickAction href="/destinations" icon={<MapPin className="h-5 w-5" />} title="By State" sub="Top places by state" />
        <QuickAction href="/festivals" icon={<CalendarClock className="h-5 w-5" />} title="Festivals" sub="Events near you" />
        <QuickAction href="/community" icon={<Users className="h-5 w-5" />} title="Community" sub="Tips & hidden gems" />
      </div>

      {/* Stats strip */}
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
        <StatPill value={stats.tripsPlanned} label="Trips planned" />
        <StatPill value={stats.placesExplored} label="Places explored" />
        <StatPill value={stats.totalSaved} label="Total saved" format={formatINR} />
      </div>

      {/* Near you — the curated places actually closest to the traveller */}
      <Section title="Near you" href="/explore-bangalore">
        <NearbyPlaces seed={citySeed} />
      </Section>

      {/* Popular rail */}
      {popularTrips.length > 0 && (
        <Section title="Popular trips" href="/destinations">
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {popularTrips.map((t) => {
              const cat = CATEGORY_BY_SLUG[t.category as CategorySlug];
              const grad = CATEGORY_GRADIENT[t.category as CategorySlug] ?? "from-sky-400 to-emerald-500";
              const total = t.budgetPerDay * t.recommendedDays;
              return (
                <Link
                  key={t.id}
                  href={`/destinations/${t.slug}`}
                  className="relative h-44 w-60 shrink-0 overflow-hidden rounded-3xl shadow-sm active:scale-[0.98]"
                >
                  <PlaceImage
                    name={t.name}
                    storedSrc={t.imageUrl}
                    hint={[t.district, t.state].filter(Boolean).join(", ")}
                    category={t.category}
                    emoji={cat?.emoji ?? "📍"}
                    gradient={grad}
                    className="absolute inset-0 h-full w-full"
                    emojiClassName="text-5xl"
                    preferWiki
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 backdrop-blur">
                    {t.recommendedDays} {t.recommendedDays === 1 ? "Day" : "Days"}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <p className="truncate text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-white/85">
                      from <span className="font-extrabold">{formatINR(total)}</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function QuickAction({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm active:scale-[0.98]"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-green-600 opacity-70" />
      <span className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
        {icon}
      </span>
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
    </Link>
  );
}

function StatPill({
  value,
  label,
  format,
}: {
  value: number;
  label: string;
  format?: (n: number) => string;
}) {
  return (
    <div className="flex min-w-[7.5rem] shrink-0 items-center gap-2.5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-sm">
      <span aria-hidden className="h-8 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-green-600" />
      <div>
        <CountUp value={value} format={format} className="block text-lg font-black text-slate-900" />
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <Reveal as="section">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900">
          <span aria-hidden className="h-4 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-green-600" />
          {title}
        </h2>
        <Link href={href} className="text-sm font-bold text-emerald-700">
          See all →
        </Link>
      </div>
      {children}
    </Reveal>
  );
}
