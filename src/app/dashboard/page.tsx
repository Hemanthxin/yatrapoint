import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
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

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { formatINR } from "@/lib/format";
import { getDashboardStats, listUpcomingTrips } from "@/lib/queries/trip-plans";
import { listNearby } from "@/lib/queries/nearby";
import { listDestinations } from "@/lib/queries/destinations";
import { CATEGORY_BY_SLUG, CATEGORY_GRADIENT, type CategorySlug } from "@/lib/catalog/categories";
import { PlaceImage } from "@/components/app/PlaceImage";
import { WeatherCard } from "@/components/app/dashboard/WeatherCard";
import { UpcomingTrips } from "@/components/app/dashboard/UpcomingTrips";
import { BudgetOverview } from "@/components/app/dashboard/BudgetOverview";
import { TrustStrip } from "@/components/app/dashboard/TrustStrip";
import { MobileDashboard } from "./MobileDashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const displayName = u.name || u.email || u.phone || "Traveller";
  const firstName = displayName.split(" ")[0] || displayName;

  const stats = await getDashboardStats(u.id ?? "");

  // Feature tiles — order matches the home design (Budget Planner first).
  const features = [
    {
      title: "Budget Planner",
      desc: "Plan your trip within budget",
      href: "/budget-planner",
      tone: "bg-emerald-100 text-emerald-700",
      icon: <Wallet className="h-5 w-5" />,
    },
    {
      title: "By State Places",
      desc: "Explore top places by state",
      href: "/destinations",
      tone: "bg-sky-100 text-sky-700",
      icon: <MapPin className="h-5 w-5" />,
    },
    {
      title: "Festivals & Events",
      desc: "Upcoming festivals & events",
      href: "/festivals",
      tone: "bg-violet-100 text-violet-700",
      icon: <CalendarClock className="h-5 w-5" />,
    },
    {
      title: "Community",
      desc: "Share tips, hidden gems & more",
      href: "/community",
      tone: "bg-amber-100 text-amber-700",
      icon: <Users className="h-5 w-5" />,
    },
  ];

  const statCards = [
    {
      label: "Trips Planned",
      value: stats.tripsPlanned.toString().padStart(2, "0"),
      href: "/one-day-trips",
      icon: <Briefcase className="h-5 w-5" />,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Places Explored",
      value: stats.placesExplored.toString(),
      href: "/destinations",
      icon: <Binoculars className="h-5 w-5" />,
      tone: "bg-sky-100 text-sky-700",
    },
    {
      label: "Saved Places",
      value: stats.placesExplored.toString().padStart(2, "0"),
      href: "/destinations",
      icon: <Bookmark className="h-5 w-5" />,
      tone: "bg-violet-100 text-violet-700",
    },
    {
      label: "Total Saved",
      value: formatINR(stats.totalSaved),
      href: "/budget-planner",
      icon: <Heart className="h-5 w-5" />,
      tone: "bg-rose-100 text-rose-700",
    },
  ];

  // Real data: nearby = one-day trips from Bangalore; popular = top Karnataka
  // destinations by popularity.
  // Degrade gracefully if the DB times out (Neon is serverless + far away) so a
  // transient hiccup never 500s the home page — the widgets just render empty.
  const [nearbyRows, popularTrips, upcoming] = await Promise.all([
    listNearby({ baseCity: "Bangalore" }).catch(() => []),
    listDestinations({ state: "Karnataka", isHidden: false, limit: 8 }).catch(() => []),
    listUpcomingTrips(u.id ?? ""),
  ]);
  const nearby = nearbyRows.slice(0, 8);

  return (
    <AppShell userLabel={displayName} userImage={u.image}>
      {/* ── Mobile (< lg): bespoke app UI ── */}
      <div className="lg:hidden">
        <MobileDashboard
          firstName={firstName}
          stats={stats}
          nearby={nearby}
          popularTrips={popularTrips}
        />
      </div>

      {/* ── Desktop (≥ lg): three-column cream + green dashboard ── */}
      <div className="hidden lg:block">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* MAIN COLUMN */}
        <div className="min-w-0 space-y-6">
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
            {/* Light wash on the left so the dark headline stays readable. */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#f7f2e9] via-[#f7f2e9]/70 to-transparent" />
            <div className="relative flex h-full max-w-md flex-col justify-center p-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                Featured Destination
              </p>
              <h1 className="mt-2 text-4xl font-black leading-[1.05] tracking-tight text-slate-900 md:text-5xl">
                Explore Karnataka,
                <br />
                <span className="text-gradient animate-shimmer">Create Memories</span>
              </h1>
              <p className="mt-3 text-sm font-medium text-slate-600">
                Smart trips. Budget friendly.
                <br />
                Unforgettable memories.
              </p>
              <Link
                href="/budget-planner"
                className="btn-primary mt-5 w-max px-6 py-3 text-sm"
              >
                Explore Now <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="mt-5 flex gap-1.5">
                <span className="h-1.5 w-6 rounded-full bg-emerald-600" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/30" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600/30" />
              </div>
            </div>
          </section>

          {/* Feature tiles */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {features.map((f) => (
              <Link
                key={f.title}
                href={f.href}
                className="card-hover group relative rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 pr-8 shadow-sm"
              >
                <div className={`mb-2.5 grid h-11 w-11 place-items-center rounded-xl ${f.tone}`}>
                  {f.icon}
                </div>
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
                  <div className={`mb-2 grid h-11 w-11 place-items-center rounded-xl ${s.tone}`}>
                    {s.icon}
                  </div>
                  <p className="truncate text-2xl font-black text-slate-900">{s.value}</p>
                  <p className="text-xs font-medium text-slate-500">{s.label}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* Near by place */}
          <section>
            <SectionHeader title="Near by place" href="/explore-bangalore" />
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {nearby.slice(0, 4).map((n) => {
                const cat = CATEGORY_BY_SLUG[n.category as CategorySlug];
                const grad = CATEGORY_GRADIENT[n.category as CategorySlug] ?? "from-sky-400 to-emerald-500";
                return (
                  <Link
                    key={n.id}
                    href={`/one-day-trips/${n.slug}`}
                    className="card-hover group relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm"
                  >
                    <div className="relative h-32 w-full">
                      <PlaceImage
                        name={n.name}
                        storedSrc={n.imageUrl}
                        hint="Karnataka"
                        category={n.category}
                        emoji={cat?.emoji ?? "📍"}
                        gradient={grad}
                        className="h-full w-full"
                        emojiClassName="text-4xl"
                      />
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-700/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                        {n.distanceKm} km
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{n.name}</p>
                        <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0" /> {n.baseCity}, Karnataka
                        </p>
                      </div>
                      <span
                        aria-hidden
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--border)] text-slate-300 transition group-hover:border-rose-200 group-hover:text-rose-400"
                      >
                        <Heart className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Trust strip */}
          <TrustStrip />
        </div>

        {/* RIGHT RAIL — weather, upcoming trips, budget overview */}
        <aside className="hidden animate-fadeUp space-y-5 xl:block">
          <WeatherCard />
          <UpcomingTrips trips={upcoming} />
          <BudgetOverview total={stats.totalBudget} />
        </aside>
      </div>
      </div>
    </AppShell>
  );
}

// Signature section header: a short green accent bar + title on the left, a
// muted "View all" on the right. Used across the desktop dashboard rails so
// every section reads as one system.
function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2.5 text-xl font-black tracking-tight text-slate-900">
        <span aria-hidden className="h-5 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-green-600" />
        {title}
      </h2>
      <Link
        href={href}
        className="text-sm font-bold text-emerald-700 transition hover:text-emerald-800 hover:underline"
      >
        View all →
      </Link>
    </div>
  );
}
