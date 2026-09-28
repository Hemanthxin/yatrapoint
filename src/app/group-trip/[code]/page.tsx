import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import {
  getGroupTripByJoinCode,
  getMembership,
  listMembers,
  listSuggestionsWithVotes,
} from "@/lib/queries/group-trips";
import { listDestinations } from "@/lib/queries/destinations";
import { GroupTripHub } from "@/components/app/group-trip/GroupTripHub";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function GroupTripHubPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const { code } = await params;

  const trip = await getGroupTripByJoinCode(code);
  if (!trip) notFound();

  const membership = await getMembership(trip.id, u.id ?? "");
  if (!membership) redirect(`/join/${trip.joinCode}`);

  const [members, suggestions, popularPlaces] = await Promise.all([
    listMembers(trip.id),
    listSuggestionsWithVotes(trip.id, u.id ?? ""),
    listDestinations({ state: trip.destinationState, district: trip.destinationDistrict ?? undefined, limit: 20 }),
  ]);

  const itinerary = trip.itineraryJson ? JSON.parse(trip.itineraryJson) : null;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <GroupTripHub
        trip={trip}
        currentUserId={u.id ?? ""}
        role={membership.role}
        members={members}
        suggestions={suggestions}
        itinerary={itinerary}
        popularPlaces={popularPlaces}
      />
    </AppShell>
  );
}
