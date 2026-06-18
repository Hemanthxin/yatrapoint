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
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Festivals &amp; Events</h1>
          <p className="text-sm text-slate-500">
            Explore upcoming festivals and events near you, and add them to your trip cart.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FESTIVALS.map((f, i) => (
          <div
            key={f.name}
            style={{ animationDelay: `${i * 70}ms` }}
            className="card-hover animate-fadeUp rounded-3xl border border-slate-200 bg-white p-6"
          >
            <div className="flex items-start justify-between">
              <span className="text-4xl">{f.emoji}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {f.month}
              </span>
            </div>
            <p className="mt-3 font-semibold text-slate-900">{f.name}</p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" /> {f.place}
            </p>
            <Link
              href="/budget-planner"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:underline"
            >
              Add to Trip Cart <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
