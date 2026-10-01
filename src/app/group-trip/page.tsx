import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users, Calendar, Wallet, ChevronRight } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { NoDataIllustration } from "@/components/illustrations";
import { PageHero } from "@/components/app/PageHero";
import { listMyGroupTrips } from "@/lib/queries/group-trips";
import { formatINR } from "@/lib/format";

export default async function GroupTripListPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const trips = await listMyGroupTrips(u.id ?? "");

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <PageHero
        eyebrow="Plan it together"
        icon={Users}
        title="Group Trip Planner"
        subtitle="Create a trip, invite friends, vote on places — Saafera builds the itinerary once you've decided."
        backgroundImage="/pagehero-bg.jpg"
      />

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Your group trips</h2>
        <Link href="/group-trip/new" className="btn-primary flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm">
          <Plus className="h-4 w-4" /> Create a group trip
        </Link>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          illustration={NoDataIllustration}
          title="No group trips yet"
          description="Create one and invite your friends to start planning together."
          className="mt-6"
          action={
            <Link href="/group-trip/new" className="btn-primary inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm">
              <Plus className="h-4 w-4" /> Create a group trip
            </Link>
          }
        />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t) => (
            <Link key={t.id} href={`/group-trip/${t.joinCode}`} className="card card-hover flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold tracking-tight text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.destinationLabel}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    t.status === "finalized" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {t.status === "finalized" ? "Finalized" : "Planning"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" /> {t.days} day{t.days > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-emerald-600" /> {t.travellers} people
                </span>
                <span className="flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600" /> {formatINR(t.totalBudget)}
                </span>
              </div>
              <span className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-700">
                Open trip <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
