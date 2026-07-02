import Image from "next/image";
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
      tone: "bg-emerald-50 text-emerald-700",
      icon: <Wallet className="h-5 w-5" />,
    },
    {
      title: "By State Places",
      desc: "Explore top places by state",
      href: "/destinations",
      tone: "bg-slate-100 text-slate-600",
      icon: <MapPin className="h-5 w-5" />,
    },
    {
      title: "Festivals & Events",
      desc: "Upcoming festivals & events",
      href: "/festivals",
      tone: "bg-slate-100 text-slate-600",
      icon: <CalendarClock className="h-5 w-5" />,
    },
    {
      title: "Community",
      desc: "Share tips, hidden gems & more",
      href: "/community",
      tone: "bg-slate-100 text-slate-600",
      icon: <Users className="h-5 w-5" />,
    },
  ];

  const statCards = [
    {
      label: "Trips Planned",
      value: stats.tripsPlanned.toString().padStart(2, "0"),
      href: "/one-day-trips",
      icon: <Briefcase className="h-5 w-5" />,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Places Explored",
      value: stats.placesExplored.toString(),
      href: "/destinations",
      icon: <Binoculars className="h-5 w-5" />,
      tone: "bg-slate-100 text-slate-600",
    },
    {
      label: "Saved Places",
      value: stats.placesExplored.toString().padStart(2, "0"),
      href: "/destinations",
      icon: <Bookmark className="h-5 w-5" />,
      tone: "bg-slate-100 text-slate-600",
    },
    {
      label: "Total Saved",
      value: formatINR(stats.totalSaved),
      href: "/budget-planner",
      icon: <Heart className="h-5 w-5" />,
      tone: "bg-emerald-50 text-emerald-700",
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
      {/* Greeting — mobile echo of the header (desktop greets in the top bar) */}
      <div className="mb-4 lg:hidden">
        <p className="text-2xl font-bold tracking-tight text-slate-900">
          Hi, {firstName} 👋
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Bengaluru, Karnataka
        </p>
      </div>

      {/* Hero banner — bleeds to the screen edges on mobile for an immersive,
          full-bleed feel; settles into a rounded card on larger screens. */}
      <section className="bleed relative overflow-hidden rounded-none border-slate-200 shadow-sm md:rounded-2xl md:border">
        <div className="relative h-56 w-full sm:h-64 md:h-72">
          <Image
            src="/66242.jpg"
            alt="Scenic Karnataka temple and waterfalls"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 70vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        </div>
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur">
          <MapPin className="h-3 w-3 text-emerald-600" /> Coorg
        </span>
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-200">
            Featured destination
          </p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
            Explore Karnataka,
            <br />
            Create Memories
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/80">
            Smart trips. Budget friendly. Unforgettable memories.
          </p>
          <Link
            href="/budget-planner"
            className="group mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
          >
            Explore Now
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* Feature tiles */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {features.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="card-hover rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
          >
            <div className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${f.tone}`}>
              {f.icon}
            </div>
            <p className="text-sm font-semibold text-slate-900">{f.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{f.desc}</p>
          </Link>
        ))}
      </section>

      {/* Activity stats */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Trips Planned</h2>
          <Link href="/one-day-trips" className="text-sm font-semibold text-emerald-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="card-hover rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${s.tone}`}>
                {s.icon}
              </div>
              <p className="truncate text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Near by place */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Near by place</h2>
          <Link href="/one-day-trips" className="text-sm font-semibold text-emerald-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {nearby.map((n) => {
            const cat = CATEGORY_BY_SLUG[n.category as CategorySlug];
            const grad = CATEGORY_GRADIENT[n.category as CategorySlug] ?? "from-emerald-400 to-teal-600";
            return (
              <Link
                key={n.id}
                href={`/one-day-trips/${n.slug}`}
                className="card-hover w-40 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:w-auto"
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
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {n.distanceKm} km
                  </span>
                </div>
                <div className="min-w-0 p-2.5">
                  <p className="truncate text-sm font-semibold text-slate-900">{n.name}</p>
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
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Popular Trips</h2>
          <Link href="/destinations" className="text-sm font-semibold text-emerald-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {popularTrips.map((t) => {
            const cat = CATEGORY_BY_SLUG[t.category as CategorySlug];
            const grad = CATEGORY_GRADIENT[t.category as CategorySlug] ?? "from-emerald-400 to-teal-600";
            const total = t.budgetPerDay * t.recommendedDays;
            return (
              <Link
                key={t.id}
                href={`/destinations/${t.slug}`}
                className="card-hover relative h-40 w-56 shrink-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm lg:w-auto"
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
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                  {t.recommendedDays} {t.recommendedDays === 1 ? "Day" : "Days"} Trip
                </span>
                <div className="absolute inset-x-0 bottom-0 min-w-0 p-3 text-white">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-white/85">
                    Starting from <span className="font-semibold">{formatINR(total)}</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
