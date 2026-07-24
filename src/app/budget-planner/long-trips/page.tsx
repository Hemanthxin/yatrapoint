import Link from "next/link";
import { redirect } from "next/navigation";
import { Route, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { listLongTripStates, listLongTripsByState } from "@/lib/queries/long-trips";

const STATE_GRADIENT: Record<string, string> = {
  Karnataka: "from-emerald-500 to-green-600",
  "Tamil Nadu": "from-rose-500 to-red-600",
  Kerala: "from-teal-500 to-emerald-700",
  "Andhra Pradesh": "from-amber-500 to-orange-600",
  Maharashtra: "from-sky-500 to-indigo-600",
};

const STATE_EMOJI: Record<string, string> = {
  Karnataka: "🌴",
  "Tamil Nadu": "🛕",
  Kerala: "🌊",
  "Andhra Pradesh": "🏞️",
  Maharashtra: "🏰",
};

export default async function LongTripsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const states = await listLongTripStates();
  const counts = await Promise.all(states.map((s) => listLongTripsByState(s)));

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp mx-auto max-w-3xl">
        <BackButton fallback="/budget-planner" />
        <header className="mt-3 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
            <Route className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Long trips from Bangalore
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Ready-made multi-day road trips — pick a state to see the itineraries.
            </p>
          </div>
        </header>

        <div className="mt-6 space-y-3">
          {states.map((state, i) => (
            <Link
              key={state}
              href={`/budget-planner/long-trips/${encodeURIComponent(state)}`}
              className="card-hover flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition"
            >
              <span
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${STATE_GRADIENT[state] ?? "from-slate-400 to-slate-600"} text-2xl text-white shadow-lg`}
              >
                {STATE_EMOJI[state] ?? "📍"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold text-slate-900">{state}</p>
                <p className="text-xs font-medium text-slate-500">
                  {counts[i].length} itineraries · {Math.min(...counts[i].map((c) => c.days))}-
                  {Math.max(...counts[i].map((c) => c.days))} days
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
