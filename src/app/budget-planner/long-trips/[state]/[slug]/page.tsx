import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Calendar, MapPin, Wallet, ExternalLink, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { getLongTripBySlug, parseItinerary, listSavedLongTripIds } from "@/lib/queries/long-trips";
import { logTripHistory } from "@/lib/actions/long-trips";
import { estimateLongTripBudget, defaultBudgetParams } from "@/lib/budget";
import { formatINR } from "@/lib/format";
import { multiStopDirectionsUrl } from "@/lib/maps";
import { TripActions } from "./TripActions";
import { Reveal } from "@/components/app/Reveal";

interface PageProps {
  params: Promise<{ state: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getLongTripBySlug(slug);
  return { title: trip ? `${trip.title} | Saafera` : "Long trip" };
}

export default async function LongTripDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const { state: rawState, slug } = await params;
  const state = decodeURIComponent(rawState);

  const trip = await getLongTripBySlug(slug);
  if (!trip || trip.state !== state) notFound();

  const itinerary = parseItinerary(trip.itinerary);
  const budget = estimateLongTripBudget({
    days: trip.days,
    distanceKm: trip.distanceKm,
    vehicle: defaultBudgetParams.vehicle,
    people: defaultBudgetParams.people,
  });
  const mapsUrl = multiStopDirectionsUrl(trip.baseCity, itinerary.map((d) => d.items));

  const [savedIds] = await Promise.all([
    listSavedLongTripIds(u.id ?? ""),
    // Log every time this plan is opened — powers "Trip history".
    logTripHistory({ kind: "long-trip", refSlug: trip.slug, title: trip.title }),
  ]);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <Reveal className="mx-auto max-w-3xl">
        <BackButton fallback={`/budget-planner/long-trips/${encodeURIComponent(state)}`} />

        <header className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
            {trip.baseCity} → {state}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {trip.title}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-500">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" /> {trip.destinationSummary}
          </p>
        </header>

        <div className="mt-4">
          <TripActions longTripId={trip.id} initialSaved={savedIds.has(trip.id)} title={trip.title} />
        </div>

        {/* Quick stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
          <Stat icon={<Calendar className="h-4 w-4" />} label="Duration" value={`${trip.days} days`} />
          <Stat
            icon={<MapPin className="h-4 w-4" />}
            label="Distance"
            value={trip.distanceKm ? `${trip.distanceKm} km one-way` : "Varies"}
          />
          <Stat icon={<Wallet className="h-4 w-4" />} label="Est. total (2 people)" value={formatINR(budget.total)} />
          <Stat icon={<Wallet className="h-4 w-4" />} label="Per person" value={formatINR(budget.perPerson)} />
        </div>

        {/* Cost split */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Estimated cost split</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Mid-range estimate for a hatchback, 2 travellers — adjust in the budget planner for your own numbers.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Fuel (round trip)" value={formatINR(budget.fuelTotal)} />
            <Row label={`Stay (${Math.max(0, trip.days - 1)} nights)`} value={formatINR(budget.stayTotal)} />
            <Row label="Food (full board)" value={formatINR(budget.foodTotal)} />
            <Row label="Entry fees & local transport" value={formatINR(budget.miscTotal)} />
            <div className="my-2 h-px bg-slate-200" />
            <div className="flex items-center justify-between">
              <dt className="text-base font-extrabold text-slate-900">Total</dt>
              <dd className="text-xl font-extrabold text-gradient">{formatINR(budget.total)}</dd>
            </div>
          </dl>
        </section>

        {/* Day-by-day itinerary */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Day-by-day plan</h2>
          <ol className="mt-4 space-y-5">
            {itinerary.map((d) => (
              <li key={d.day} className="relative pl-8">
                <span className="absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-xs font-bold text-white">
                  {d.day}
                </span>
                <p className="text-sm font-extrabold text-slate-800">Day {d.day}</p>
                <ul className="mt-1.5 space-y-1">
                  {d.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-slate-600">
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.01] active:scale-95"
        >
          Open full route in Google Maps <ExternalLink className="h-4 w-4" />
        </a>

        <p className="mt-3 text-center text-xs text-slate-400">
          Distances, costs and timings are indicative — always reconfirm details before you travel.
        </p>
      </Reveal>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-emerald-600 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-sm font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
