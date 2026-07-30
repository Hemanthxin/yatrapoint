"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  MapPin,
  Wallet,
  CalendarClock,
  Users,
  Heart,
  Briefcase,
  Binoculars,
  Bookmark,
} from "lucide-react";

import { formatINR } from "@/lib/format";
import { WeatherCard } from "@/components/app/dashboard/WeatherCard";
import { UpcomingTrips } from "@/components/app/dashboard/UpcomingTrips";
import { BudgetOverview } from "@/components/app/dashboard/BudgetOverview";
import { TrustStrip } from "@/components/app/dashboard/TrustStrip";
import { NearbyPlaces } from "@/components/app/dashboard/NearbyPlaces";
import type { DashboardStats, UpcomingTrip } from "@/lib/queries/trip-plans";
import type { CityPlace } from "@/lib/db/schema";
import { Reveal } from "@/components/app/Reveal";
import { RevealGrid } from "@/components/app/RevealGrid";
import { ParallaxImage } from "@/components/app/ParallaxImage";
import { CountUp } from "@/components/app/CountUp";

interface Props {
  stats: DashboardStats;
  citySeed: CityPlace[];
  upcoming: UpcomingTrip[];
  // Admin-uploaded hero banner image (data URL) — falls back to the built-in
  // default photo when the admin hasn't set one.
  heroImageUrl?: string | null;
}

export function DesktopDashboard({ stats, citySeed, upcoming, heroImageUrl }: Props) {
  const tone = "bg-emerald-100 text-emerald-700";
  const features = [
    { title: "Trip Planner", desc: "Plan your trip within budget", href: "/budget-planner", tone, icon: <Wallet className="h-5 w-5" /> },
    { title: "By State Places", desc: "Explore top places by state", href: "/destinations", tone, icon: <MapPin className="h-5 w-5" /> },
    { title: "Festivals & Events", desc: "Upcoming festivals & events", href: "/festivals", tone, icon: <CalendarClock className="h-5 w-5" /> },
    { title: "Community", desc: "Share tips, hidden gems & more", href: "/community", tone, icon: <Users className="h-5 w-5" /> },
  ];
  const statCards = [
    { label: "Trips Planned", value: stats.tripsPlanned, format: (n: number) => Math.round(n).toString().padStart(2, "0"), href: "/one-day-trips", icon: <Briefcase className="h-5 w-5" />, tone },
    { label: "Places Explored", value: stats.placesExplored, format: undefined as ((n: number) => string) | undefined, href: "/destinations", icon: <Binoculars className="h-5 w-5" />, tone },
    { label: "Saved Places", value: stats.placesExplored, format: (n: number) => Math.round(n).toString().padStart(2, "0"), href: "/destinations", icon: <Bookmark className="h-5 w-5" />, tone },
    { label: "Total Saved", value: stats.totalSaved, format: formatINR, href: "/budget-planner", icon: <Heart className="h-5 w-5" />, tone },
  ];

  return (
    <div className="space-y-6">
    <div className="flex flex-col gap-6 xl:flex-row">
      {/* MAIN COLUMN */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Featured hero */}
        <Reveal as="section" className="relative h-72 overflow-hidden rounded-[1.75rem] shadow-xl shadow-emerald-900/10 md:h-80" amount={0}>
          <ParallaxImage
            src={heroImageUrl || "/66242.jpg"}
            alt="Scenic Karnataka temple and waterfalls"
            priority
            sizes="(max-width: 1280px) 100vw, 60vw"
            className="object-cover"
          />
          {/* Dark scrim so white text sits comfortably over the photo — still
              image renders at full opacity, the fade just clears sooner. */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 via-emerald-950/55 via-45% to-transparent" />
          <div className="relative flex h-full max-w-lg flex-col justify-center p-10">
            <p className="inline-flex w-max items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200 backdrop-blur-sm">
              <MapPin className="h-3 w-3" /> Featured Destination
            </p>
            <h1 className="mt-3 whitespace-nowrap font-serif text-[2.9rem] font-semibold leading-[1.05] tracking-tight text-white drop-shadow-sm">
              Explore Karnataka,
              <br />
              <span className="italic text-emerald-300">Create Memories</span>
            </h1>
            <p className="mt-3 max-w-xs text-[15px] font-medium leading-relaxed text-emerald-50/80 drop-shadow-sm">
              Smart trips. Budget friendly.
              <br />
              Unforgettable memories.
            </p>
            <Link href="/budget-planner" className="btn-primary mt-4 w-max px-6 py-2.5 text-sm">
              Explore Now <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="mt-4 flex gap-1.5">
              <span className="h-1.5 w-6 rounded-full bg-white" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            </div>
          </div>
          <LeafSprig className="pointer-events-none absolute bottom-3 right-4 h-24 w-24 rotate-12 text-white/20" />
        </Reveal>

        {/* Feature tiles */}
        <RevealGrid className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {features.map((f) => (
            <Reveal key={f.title}>
              <Link
                href={f.href}
                className="card-hover group relative block h-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 pr-8 shadow-sm"
              >
                <div className={`mb-3 grid h-11 w-11 place-items-center rounded-xl ${f.tone}`}>{f.icon}</div>
                <p className="font-serif text-base font-semibold tracking-tight text-slate-900">{f.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{f.desc}</p>
                <ChevronRight className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
              </Link>
            </Reveal>
          ))}
        </RevealGrid>

        {/* Trips Planned stats */}
        <section>
          <SectionHeader title="Trips Planned" href="/one-day-trips" />
          <RevealGrid className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statCards.map((s) => (
              <Reveal key={s.label}>
                <Link
                  href={s.href}
                  className="card-hover block h-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm"
                >
                  <div className={`mb-2.5 grid h-11 w-11 place-items-center rounded-xl ${s.tone}`}>{s.icon}</div>
                  <CountUp value={s.value} format={s.format} className="block truncate font-serif text-2xl font-semibold text-slate-900" />
                  <p className="text-xs font-medium text-slate-500">{s.label}</p>
                </Link>
              </Reveal>
            ))}
          </RevealGrid>
        </section>

        {/* Near by place — the places actually closest to the traveller */}
        <section>
          <SectionHeader title="Near by place" href="/explore-bangalore" />
          <NearbyPlaces seed={citySeed} />
        </section>
      </div>

      {/* WIDGETS — a right rail on xl; a full-width row below on lg/tablet so
          the weather + trips + budget are visible on every screen size. */}
      <Reveal as="aside" className="w-full xl:w-80 xl:shrink-0" amount={0}>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <WeatherCard />
          <UpcomingTrips trips={upcoming} />
          <div className="sm:col-span-2 xl:col-span-1">
            <BudgetOverview total={stats.totalBudget} />
          </div>
        </div>
      </Reveal>
    </div>

    {/* Trust strip — full width. */}
    <div className="relative">
      <LeafSprig className="pointer-events-none absolute -right-2 -top-8 h-20 w-20 text-emerald-500/40" />
      <TrustStrip />
    </div>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2.5 font-serif text-2xl font-semibold tracking-tight text-slate-900">
        <span aria-hidden className="h-5 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-green-600" />
        {title}
      </h2>
      <Link href={href} className="text-sm font-bold text-emerald-700 transition hover:text-emerald-800 hover:underline">
        View all →
      </Link>
    </div>
  );
}

function LeafSprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className} aria-hidden>
      <path d="M58 6C36 8 20 18 14 36c-2 6-2 13 0 19 1 3 5 3 6 0 2-6 5-11 9-15 5-5 12-8 19-9-6-1-12 0-17 3 6-11 16-19 29-22 1 0 1-6-2-6z" />
      <path d="M20 52c4-14 13-24 27-30" stroke="#fff" strokeWidth="1.5" fill="none" opacity=".5" />
    </svg>
  );
}
