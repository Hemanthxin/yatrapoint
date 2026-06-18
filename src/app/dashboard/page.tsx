import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Binoculars,
  ShoppingBag,
  CalendarClock,
  MapPin,
  Users,
  Compass,
  Pencil,
  Wallet,
} from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { formatINR } from "@/lib/format";
import { getDashboardStats } from "@/lib/queries/trip-plans";
import { listPublishedPosts } from "@/lib/queries/community";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const displayName = u.name || u.email || u.phone || "Traveller";

  const [stats, posts] = await Promise.all([
    getDashboardStats(u.id),
    listPublishedPosts(2),
  ]);

  const statCards = [
    {
      label: "Trips Planned",
      value: stats.tripsPlanned.toString().padStart(2, "0"),
      action: "View all trips",
      href: "/one-day-trips",
      icon: <Briefcase className="h-5 w-5" />,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Places Explored",
      value: stats.placesExplored.toString(),
      action: "View all places",
      href: "/destinations",
      icon: <Binoculars className="h-5 w-5" />,
      tone: "bg-sky-100 text-sky-700",
    },
    {
      label: "Total Saved",
      value: formatINR(stats.totalSaved),
      action: "View savings",
      href: "/budget-planner",
      icon: <ShoppingBag className="h-5 w-5" />,
      tone: "bg-violet-100 text-violet-700",
    },
    {
      label: "Upcoming Trip",
      value: stats.upcomingTrip?.name ?? "Plan one →",
      action: stats.upcomingTrip ? `${stats.upcomingTrip.days} days planned` : "Start planning",
      href: "/budget-planner",
      icon: <CalendarClock className="h-5 w-5" />,
      tone: "bg-amber-100 text-amber-700",
    },
  ];

  const features = [
    {
      title: "By State Places",
      desc: "Explore top tourist places by state",
      href: "/destinations",
      tone: "bg-emerald-50",
      icon: <MapPin className="h-5 w-5 text-emerald-600" />,
    },
    {
      title: "Community",
      desc: "Share hidden gems, tips and travel stories with the community",
      href: "/community",
      tone: "bg-sky-50",
      icon: <Users className="h-5 w-5 text-sky-600" />,
    },
    {
      title: "Festival & Events",
      desc: "Explore upcoming festivals and events near you",
      href: "/festivals",
      tone: "bg-amber-50",
      icon: <CalendarClock className="h-5 w-5 text-amber-600" />,
    },
    {
      title: "Trips by Places",
      desc: "Plan trips to your favorite places",
      href: "/trip-categories",
      tone: "bg-rose-50",
      icon: <Compass className="h-5 w-5 text-rose-600" />,
    },
  ];

  const nearby = [
    { name: "Abbey Falls", place: "Madikeri, Karnataka", km: 12, img: "/66242.jpg" },
    { name: "Raja's Seat", place: "Madikeri, Karnataka", km: 15, img: "/66245.jpg" },
    { name: "Kootu Holey Dam", place: "Madikeri, Karnataka", km: 18, img: "/66242.jpg" },
    { name: "Dubare Elephant Camp", place: "Madikeri, Karnataka", km: 22, img: "/66245.jpg" },
  ];

  const tripsByPlaces = [
    { name: "Coorg Trip", nights: "2N / 3D", price: "₹4,999", img: "/66242.jpg" },
    { name: "Hampi Trip", nights: "2N / 3D", price: "₹4,799", img: "/66245.jpg" },
  ];

  return (
    <AppShell userLabel={displayName} userImage={u.image}>
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className="relative h-52 w-full md:h-64">
          <Image
            src="/66242.jpg"
            alt="Scenic temple and mountains"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 70vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
        </div>
        <div className="absolute inset-0 flex items-center justify-between gap-4 p-6 md:p-10">
          <div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Explore more,
              <br />
              <span className="text-emerald-400">Spend less.</span>
            </h1>
            <p className="mt-3 text-sm text-white/85">
              Smart trips. Budget friendly. Unforgettable memories.
            </p>
          </div>
          <div className="hidden w-64 shrink-0 rounded-2xl bg-black/40 p-5 backdrop-blur-sm md:block">
            <p className="text-base font-bold text-white">Plan your next trip</p>
            <p className="mt-1 text-xs text-white/75">
              Get AI-powered suggestions based on your budget
            </p>
            <Link
              href="/budget-planner"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Explore Trips <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stat cards — clickable, DB-driven */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
          >
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${s.tone}`}>
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="truncate text-xl font-bold text-slate-900">{s.value}</p>
              <span className="text-xs font-medium text-emerald-600">{s.action} →</span>
            </div>
          </Link>
        ))}
      </section>

      {/* Feature cards */}
      <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className={`group flex items-start justify-between gap-3 rounded-2xl ${f.tone} p-5 transition hover:shadow-md`}
          >
            <div>
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/70">
                {f.icon}
              </div>
              <p className="font-semibold text-slate-900">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{f.desc}</p>
            </div>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-slate-600 transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </section>

      {/* Near By & Main Places */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Near By &amp; Main Places</h2>
          <Link href="/explore-bangalore" className="text-sm font-medium text-emerald-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {nearby.map((n) => (
            <Link
              key={n.name}
              href="/explore-bangalore"
              className="group relative h-40 overflow-hidden rounded-2xl"
            >
              <Image
                src={n.img}
                alt={n.name}
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-700">
                <ArrowRight className="h-4 w-4" />
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <p className="text-sm font-semibold">{n.name}</p>
                <p className="flex items-center gap-1 text-xs text-white/80">
                  {n.place}
                  <span className="ml-auto inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {n.km} km
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom 3-column row */}
      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Trips by Places */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Trips by Places</h3>
            <Link href="/trip-categories" className="text-xs font-medium text-emerald-600 hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {tripsByPlaces.map((t) => (
              <li key={t.name} className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-xl">
                  <Image src={t.img} alt={t.name} fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.nights}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{t.price}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Community Updates — real published posts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Community Updates</h3>
            <Link href="/community" className="text-xs font-medium text-emerald-600 hover:underline">
              View all
            </Link>
          </div>
          {posts.length === 0 ? (
            <Link href="/community" className="block rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500 hover:bg-slate-100">
              No posts yet — be the first to share a hidden place →
            </Link>
          ) : (
            <ul className="space-y-4">
              {posts.map((p) => (
                <li key={p.id} className="flex gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    {(p.authorName ?? "T").charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{p.authorName ?? "Traveller"}</p>
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{p.title}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Budget Planner widget */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Budget Planner</h3>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xs text-slate-500">Your Budget</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-emerald-600">₹ 5,000</p>
            <Pencil className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-4">
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div className="h-1.5 w-[35%] rounded-full bg-emerald-500" />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-400">
              <span>₹1K</span>
              <span>₹5K</span>
              <span>₹10K</span>
              <span>₹20K</span>
              <span>₹50K+</span>
            </div>
          </div>
          <Link
            href="/budget-planner"
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Plan a trip <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
