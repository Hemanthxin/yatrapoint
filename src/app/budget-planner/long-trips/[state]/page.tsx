import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Calendar, MapPin, Wallet, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { listLongTripsByState } from "@/lib/queries/long-trips";
import { estimateLongTripBudget, defaultBudgetParams } from "@/lib/budget";
import { formatINR } from "@/lib/format";

interface PageProps {
  params: Promise<{ state: string }>;
}

export default async function LongTripsByStatePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const { state: rawState } = await params;
  const state = decodeURIComponent(rawState);

  const trips = await listLongTripsByState(state);
  if (trips.length === 0) notFound();

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp mx-auto max-w-3xl">
        <BackButton fallback="/budget-planner/long-trips" />
        <header className="mt-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {state} <span className="text-gradient">road trips</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {trips.length} curated itineraries from Bangalore, 2 to 10 days.
          </p>
        </header>

        <div className="mt-6 space-y-3">
          {trips.map((trip) => {
            const budget = estimateLongTripBudget({
              days: trip.days,
              distanceKm: trip.distanceKm,
              vehicle: defaultBudgetParams.vehicle,
              people: defaultBudgetParams.people,
            });
            return (
              <Link
                key={trip.id}
                href={`/budget-planner/long-trips/${encodeURIComponent(state)}/${trip.slug}`}
                className="card-hover block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-900">{trip.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {trip.destinationSummary}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" /> {trip.days} days
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    <Wallet className="h-3.5 w-3.5" /> ~{formatINR(budget.perPerson)} pp
                  </span>
                  {trip.distanceKm && (
                    <span className="text-slate-400">{trip.distanceKm} km one-way</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
