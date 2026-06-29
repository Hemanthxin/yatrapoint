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
      tone: "bg-amber-100 text-amber-700",
      icon: <CalendarClock className="h-5 w-5" />,
    },
    {
      title: "Community",
      desc: "Share tips, hidden gems & more",
      href: "/community",
      tone: "bg-violet-100 text-violet-700",
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
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "Total Saved",
      value: formatINR(stats.totalSaved),
      href: "/budget-planner",
      icon: <Heart className="h-5 w-5" />,
      tone: "bg-rose-100 text-rose-700",
    },
  ];

  const nearby = [
    { name: "Abbey Falls", place: "Madikeri, Kodagu", km: 12, entry: "₹50 Entry", img: "/66242.jpg" },
    { name: "Namdroling Monastery", place: "Bylakuppe", km: 25, entry: "Free Entry", img: "/66245.jpg" },
    { name: "Harangi Dam", place: "Somwarpet, Kodagu", km: 18, entry: "₹25 Entry", img: "/66242.jpg" },
    { name: "Raja's Seat", place: "Madikeri, Kodagu", km: 32, entry: "₹100 Entry", img: "/66245.jpg" },
  ];

  const popularTrips = [
    { name: "Mysore 1-Day Trip", days: "1 Day Trip", price: "₹1,299", img: "/66242.jpg" },
    { name: "Coorg Weekend Trip", days: "2 Days Trip", price: "₹3,499", img: "/66245.jpg" },
    { name: "Hampi Explorer Trip", days: "2 Days Trip", price: "₹2,999", img: "/66242.jpg" },
    { name: "Chikmagalur Trip", days: "2 Days Trip", price: "₹2,799", img: "/66245.jpg" },
  ];

  return (
    <AppShell userLabel={displayName} userImage={u.image}>
      {/* Greeting — mobile echo of the header (desktop greets in the top bar) */}
      <div className="mb-4 lg:hidden">
        <p className="text-xl font-bold text-slate-900">Hi, {firstName} 👋</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Bengaluru, Karnataka
        </p>
      </div>

      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className="relative h-56 w-full md:h-72">
          <Image
            src="/66242.jpg"
            alt="Scenic Karnataka temple and waterfalls"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 70vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
        </div>
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 backdrop-blur">
          <MapPin className="h-3 w-3 text-emerald-600" /> Coorg
        </span>
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
          <h1 className="text-2xl font-bold leading-tight text-white md:text-4xl">
            Explore Karnataka,
            <br />
            <span className="text-emerald-400">Create Memories</span>
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/85">
            Smart trips. Budget friendly. Unforgettable memories.
          </p>
          <Link
            href="/budget-planner"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.03] hover:bg-emerald-600"
          >
            Explore Now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Feature tiles */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {features.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="card-hover rounded-2xl border border-slate-200 bg-white p-3.5"
          >
            <div className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${f.tone}`}>
              {f.icon}
            </div>
            <p className="text-sm font-bold text-slate-900">{f.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{f.desc}</p>
          </Link>
        ))}
      </section>

      {/* Activity stats */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Trips Planned</h2>
          <Link href="/one-day-trips" className="text-sm font-semibold text-emerald-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="card-hover rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${s.tone}`}>
                {s.icon}
              </div>
              <p className="truncate text-2xl font-extrabold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Near by place */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Near by place</h2>
          <Link href="/explore-bangalore" className="text-sm font-semibold text-emerald-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {nearby.map((n) => (
            <Link
              key={n.name}
              href="/explore-bangalore"
              className="card-hover w-40 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:w-auto"
            >
              <div className="relative h-24 w-full">
                <Image src={n.img} alt={n.name} fill sizes="160px" className="object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {n.km} km
                </span>
                <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-rose-500">
                  <Heart className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-semibold text-slate-900">{n.name}</p>
                <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                  <MapPin className="h-3 w-3" /> {n.place}
                </p>
                <p
                  className={`mt-1 text-xs font-bold ${
                    n.entry === "Free Entry" ? "text-emerald-600" : "text-slate-700"
                  }`}
                >
                  {n.entry}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular trips */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Popular Trips</h2>
          <Link href="/one-day-trips" className="text-sm font-semibold text-emerald-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {popularTrips.map((t) => (
            <Link
              key={t.name}
              href="/one-day-trips"
              className="card-hover relative h-40 w-56 shrink-0 overflow-hidden rounded-2xl lg:w-auto"
            >
              <Image src={t.img} alt={t.name} fill sizes="224px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                {t.days}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <p className="text-sm font-bold">{t.name}</p>
                <p className="text-xs text-white/85">
                  Starting from <span className="font-bold">{t.price}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
