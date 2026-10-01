import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Calendar, MapPin, Users, Wallet } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { getGroupTripByJoinCode, getMembership } from "@/lib/queries/group-trips";
import { formatINR } from "@/lib/format";
import { InviteActions } from "./InviteActions";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function GroupTripInvitePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const { code } = await params;

  const trip = await getGroupTripByJoinCode(code);
  if (!trip) notFound();
  const membership = await getMembership(trip.id, u.id ?? "");
  if (!membership) redirect(`/join/${trip.joinCode}`);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="mx-auto mt-6 max-w-xl space-y-5">
        <div className="card flex items-start gap-3 border-blue-200 bg-blue-50/60 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-extrabold text-blue-800">Trip created!</p>
            <p className="text-xs text-blue-700">Let's invite your friends to plan together.</p>
          </div>
        </div>

        <div className="card space-y-2 p-5">
          <p className="text-lg font-extrabold tracking-tight text-slate-900">{trip.name}</p>
          <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              {trip.startDate ?? "—"} → {trip.endDate ?? "—"} ({trip.days} day{trip.days > 1 ? "s" : ""})
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-blue-600" /> {trip.travellers} people
            </span>
            <span className="flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5 text-blue-600" /> {formatINR(trip.totalBudget)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-blue-600" /> {trip.startLabel} → {trip.destinationLabel}
            </span>
          </div>
        </div>

        <InviteActions joinCode={trip.joinCode} tripName={trip.name} />

        <Link href={`/group-trip/${trip.joinCode}`} className="btn-primary block w-full rounded-2xl py-3 text-center text-sm">
          Continue to trip
        </Link>
      </div>
    </AppShell>
  );
}
