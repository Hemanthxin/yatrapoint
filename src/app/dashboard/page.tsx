import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
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
import { getDashboardStats } from "@/lib/queries/trip-plans";
import { listNearby } from "@/lib/queries/nearby";
import { listDestinations } from "@/lib/queries/destinations";
import { CATEGORY_BY_SLUG, CATEGORY_GRADIENT, type CategorySlug } from "@/lib/catalog/categories";
import { PlaceImage } from "@/components/app/PlaceImage";
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
  const [nearbyRows, popularTrips] = await Promise.all([
    listNearby({ baseCity: "Bangalore" }),
    listDestinations({ state: "Karnataka", isHidden: false, limit: 8 }),
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

      {/* ── Desktop (≥ lg): cream + green editorial dashboard ── */}
      <div className="hidden space-y-8 lg:block">
      {/* Greeting row */}
      <div className="flex items-end justify-between gap-4 animate-fadeUp">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-[color:var(--highlight)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--highlight)]" />
            Namaste 🙏
          </p>
          <h1 className="mt-1 text-4xl font-black leading-tight tracking-tight text-slate-900">
            Good to see you, {firstName}
          </h1>
        </div>
        <Link
          href="/budget-planner"
          className="btn-primary shrink-0 px-5 py-3 text-sm"
        >
          <Wallet className="h-4 w-4" /> Plan a new trip
        </Link>
      </div>

      {/* Hero bento — a green story panel beside the featured place. */}
      <section className="grid animate-fadeUp gap-4 lg:grid-cols-5">
        <div className="relative col-span-3 overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-700 p-9 text-white shadow-xl shadow-emerald-900/20">
          {/* Contour texture + warm glow for depth. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{ backgroundImage: "repeating-linear-gradient(125deg, #fff 0 1px, transparent 1px 26px)" }}
          />
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[color:var(--highlight)]/30 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">Explore Karnataka</p>
            <h2 className="mt-3 max-w-md text-4xl font-black leading-[1.05] tracking-tight">
              Smart trips, within your budget.
            </h2>
            <p className="mt-3 max-w-sm text-sm font-medium text-white/80">
              From ancient temples to hidden waterfalls — plan a full day out for exactly what you want to spend.
            </p>
            <Link
              href="/budget-planner"
              className="group mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#fffdf8] px-5 py-3 text-sm font-bold text-emerald-800 shadow-lg transition hover:scale-[1.03] active:scale-95"
            >
              Start planning
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <div className="mt-7 flex gap-6 border-t border-white/15 pt-5">
              <div>
                <p className="text-2xl font-black">{stats.tripsPlanned.toString().padStart(2, "0")}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Trips planned</p>
              </div>
              <div>
                <p className="text-2xl font-black">{stats.placesExplored}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Places explored</p>
              </div>
              <div>
                <p className="text-2xl font-black">{formatINR(stats.totalSaved)}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Total saved</p>
              </div>
            </div>
          </div>
        </div>

        {popularTrips[0] && (
          <Link
            href={`/destinations/${popularTrips[0].slug}`}
            className="card-hover group relative col-span-2 overflow-hidden rounded-[2rem] border border-[color:var(--border)] shadow-sm"
          >
            <PlaceImage
              name={popularTrips[0].name}
              storedSrc={popularTrips[0].imageUrl}
              hint={[popularTrips[0].district, popularTrips[0].state].filter(Boolean).join(", ")}
              category={popularTrips[0].category}
              emoji={CATEGORY_BY_SLUG[popularTrips[0].category as CategorySlug]?.emoji ?? "📍"}
              gradient={CATEGORY_GRADIENT[popularTrips[0].category as CategorySlug] ?? "from-sky-400 to-emerald-500"}
              className="absolute inset-0 h-full w-full"
              emojiClassName="text-6xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#fffdf8]/90 px-3 py-1 text-xs font-bold text-emerald-800 backdrop-blur">
              <MapPin className="h-3 w-3" /> Featured
            </span>
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <h3 className="text-xl font-black leading-tight drop-shadow">{popularTrips[0].name}</h3>
              <p className="mt-1 text-xs font-medium text-white/85">
                {[popularTrips[0].district, popularTrips[0].state].filter(Boolean).join(", ")}
              </p>
            </div>
          </Link>
        )}
      </section>

      {/* Feature tiles — clean cream cards with a green top accent on hover. */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {features.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="card-hover group relative overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm"
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-emerald-500 to-green-600 transition-transform duration-300 group-hover:scale-x-100" />
            <div className={`mb-3 grid h-12 w-12 place-items-center rounded-2xl ${f.tone}`}>
              {f.icon}
            </div>
            <p className="flex items-center justify-between text-sm font-bold tracking-tight text-slate-900">
              {f.title}
              <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
            </p>
            <p className="mt-1 text-[12px] leading-snug text-slate-500">{f.desc}</p>
          </Link>
        ))}
      </section>

      {/* Activity stats */}
      <section>
        <SectionHeader title="Your activity" href="/one-day-trips" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="card-hover flex items-center gap-3 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm"
            >
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${s.tone}`}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="truncate text-2xl font-black text-slate-900">{s.value}</p>
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Near by place */}
      <section>
        <SectionHeader title="Near by place" href="/explore-bangalore" />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {nearby.map((n) => {
            const cat = CATEGORY_BY_SLUG[n.category as CategorySlug];
            const grad = CATEGORY_GRADIENT[n.category as CategorySlug] ?? "from-sky-400 to-emerald-500";
            return (
              <Link
                key={n.id}
                href={`/one-day-trips/${n.slug}`}
                className="card-hover w-40 shrink-0 overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm lg:w-auto"
              >
                <div className="relative h-24 w-full">
                  <PlaceImage
                    name={n.name}
                    storedSrc={n.imageUrl}
                    hint="Karnataka"
                    category={n.category}
                    emoji={cat?.emoji ?? "📍"}
                    gradient={grad}
                    className="h-full w-full"
                    emojiClassName="text-3xl"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                    {n.distanceKm} km
                  </span>
                </div>
                <div className="min-w-0 p-2.5">
                  <p className="truncate text-sm font-bold text-slate-900">{n.name}</p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" /> {cat?.label ?? n.category} · from Bangalore
                  </p>
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      n.entryFeePerPerson === 0 ? "text-emerald-600" : "text-slate-700"
                    }`}
                  >
                    {n.entryFeePerPerson === 0 ? "Free Entry" : `₹${n.entryFeePerPerson} Entry`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Popular trips */}
      <section>
        <SectionHeader title="Popular Trips" href="/destinations" />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {popularTrips.map((t) => {
            const cat = CATEGORY_BY_SLUG[t.category as CategorySlug];
            const grad = CATEGORY_GRADIENT[t.category as CategorySlug] ?? "from-sky-400 to-emerald-500";
            const total = t.budgetPerDay * t.recommendedDays;
            return (
              <Link
                key={t.id}
                href={`/destinations/${t.slug}`}
                className="card-hover relative h-40 w-56 shrink-0 overflow-hidden rounded-3xl border border-[color:var(--border)] shadow-sm lg:w-auto"
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
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 backdrop-blur">
                  {t.recommendedDays} {t.recommendedDays === 1 ? "Day" : "Days"} Trip
                </span>
                <div className="absolute inset-x-0 bottom-0 min-w-0 p-3 text-white">
                  <p className="truncate text-sm font-bold">{t.name}</p>
                  <p className="text-xs text-white/85">
                    Starting from <span className="font-extrabold">{formatINR(total)}</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
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
