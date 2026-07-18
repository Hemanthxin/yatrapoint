import Image from "next/image";
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

interface Props {
  stats: DashboardStats;
  citySeed: CityPlace[];
  upcoming: UpcomingTrip[];
}

export function DesktopDashboard({ stats, citySeed, upcoming }: Props) {
  const tone = "bg-emerald-100 text-emerald-700";
  const features = [
    { title: "Trip Planner", desc: "Plan your trip within budget", href: "/budget-planner", tone, icon: <Wallet className="h-5 w-5" /> },
    { title: "By State Places", desc: "Explore top places by state", href: "/destinations", tone, icon: <MapPin className="h-5 w-5" /> },
    { title: "Festivals & Events", desc: "Upcoming festivals & events", href: "/festivals", tone, icon: <CalendarClock className="h-5 w-5" /> },
    { title: "Community", desc: "Share tips, hidden gems & more", href: "/community", tone, icon: <Users className="h-5 w-5" /> },
  ];
  const statCards = [
    { label: "Trips Planned", value: stats.tripsPlanned.toString().padStart(2, "0"), href: "/one-day-trips", icon: <Briefcase className="h-5 w-5" />, tone },
    { label: "Places Explored", value: stats.placesExplored.toString(), href: "/destinations", icon: <Binoculars className="h-5 w-5" />, tone },
    { label: "Saved Places", value: stats.placesExplored.toString().padStart(2, "0"), href: "/destinations", icon: <Bookmark className="h-5 w-5" />, tone },
    { label: "Total Saved", value: formatINR(stats.totalSaved), href: "/budget-planner", icon: <Heart className="h-5 w-5" />, tone },
  ];

  return (
    <div className="space-y-6">
    <div className="flex flex-col gap-6 xl:flex-row">
      {/* MAIN COLUMN */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Featured hero */}
        <section className="animate-fadeUp relative h-72 overflow-hidden rounded-[1.75rem] shadow-xl shadow-emerald-900/10 md:h-80">
          <Image
            src="/66242.jpg"
            alt="Scenic Karnataka temple and waterfalls"
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 60vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f7f2e9] via-[#f7f2e9]/85 via-40% to-transparent" />
          <div className="relative flex h-full max-w-lg flex-col justify-center p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">Featured Destination</p>
            <h1 className="mt-2 whitespace-nowrap text-[2.35rem] font-black leading-[1.08] tracking-tight text-slate-900">
              Explore Karnataka,
              <br />
              <span className="text-gradient animate-shimmer">Create Memories</span>
            </h1>
            <p className="mt-2.5 text-sm font-medium leading-snug text-slate-600">
              Smart trips. Budget friendly.
              <br />
              Unforgettable memories.
            </p>
            <Link href="/budget-planner" className="btn-primary mt-4 w-max px-6 py-2.5 text-sm">
              Explore Now <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="mt-4 flex gap-1.5">
              <span className="h-1.5 w-6 rounded-full bg-emerald-600" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/30" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/30" />
            </div>
          </div>
          <LeafSprig className="pointer-events-none absolute bottom-3 right-4 h-24 w-24 rotate-12 text-emerald-500/40" />
        </section>

        {/* Feature tiles */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {features.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="card-hover group relative rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 pr-8 shadow-sm"
            >
              <div className={`mb-2.5 grid h-11 w-11 place-items-center rounded-xl ${f.tone}`}>{f.icon}</div>
              <p className="text-sm font-bold tracking-tight text-slate-900">{f.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{f.desc}</p>
              <ChevronRight className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
            </Link>
          ))}
        </section>

        {/* Trips Planned stats */}
        <section>
          <SectionHeader title="Trips Planned" href="/one-day-trips" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statCards.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="card-hover rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm"
              >
                <div className={`mb-2 grid h-11 w-11 place-items-center rounded-xl ${s.tone}`}>{s.icon}</div>
                <p className="truncate text-2xl font-black text-slate-900">{s.value}</p>
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Near by place — the places actually closest to the traveller */}
        <section>
          <SectionHeader title="Near by place" href="/explore-bangalore" />
          <NearbyPlaces seed={citySeed} />
        </section>
      </div>

      {/* WIDGETS — a right rail on xl; a full-width row below on lg/tablet so
          the weather + trips + budget are visible on every screen size. */}
      <aside className="w-full animate-fadeUp xl:w-80 xl:shrink-0">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <WeatherCard />
          <UpcomingTrips trips={upcoming} />
          <div className="sm:col-span-2 xl:col-span-1">
            <BudgetOverview total={stats.totalBudget} />
          </div>
        </div>
      </aside>
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
      <h2 className="flex items-center gap-2.5 text-xl font-black tracking-tight text-slate-900">
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
