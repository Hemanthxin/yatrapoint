import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, MapPin, ArrowRight } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";

const FESTIVALS = [
  { name: "Mysuru Dasara", place: "Mysuru, Karnataka", month: "Oct", emoji: "🪔" },
  { name: "Hampi Utsav", place: "Hampi, Karnataka", month: "Nov", emoji: "🎭" },
  { name: "Kambala Buffalo Race", place: "Dakshina Kannada", month: "Dec", emoji: "🐃" },
  { name: "Karaga Festival", place: "Bengaluru, Karnataka", month: "Apr", emoji: "🏺" },
  { name: "Pattadakal Dance Fest", place: "Bagalkot, Karnataka", month: "Jan", emoji: "💃" },
  { name: "Kadalekai Parishe", place: "Bengaluru, Karnataka", month: "Nov", emoji: "🥜" },
];

export default async function FestivalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Festivals &amp; Events
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Upcoming festivals near you — add them to your trip cart.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FESTIVALS.map((f, i) => (
          <div
            key={f.name}
            style={{ animationDelay: `${i * 70}ms` }}
            className="card-hover animate-fadeUp flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white"
          >
            <div className="relative flex items-center justify-between bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-4">
              <span className="text-4xl drop-shadow-sm sm:text-5xl">{f.emoji}</span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-orange-700 backdrop-blur">
                {f.month}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <p className="font-extrabold tracking-tight text-slate-900">{f.name}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {f.place}
              </p>
              <Link
                href="/budget-planner"
                className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-emerald-600 hover:gap-2.5 hover:text-emerald-700"
              >
                Add to Trip Cart <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
      </div>
    </AppShell>
  );
}
