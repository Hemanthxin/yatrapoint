import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getGroupTripByJoinCode } from "@/lib/queries/group-trips";
import { joinGroupTripByCode } from "@/lib/actions/group-trips";

interface PageProps {
  params: Promise<{ code: string }>;
}

// The public invite-link target ("saafera.com/join/CODE"). Signed out ->
// bounce to sign-in and back (same `?from=` pattern middleware.ts already
// uses for protected pages); signed in -> join then land in the trip hub.
export default async function JoinGroupTripPage({ params }: PageProps) {
  const { code } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/?from=${encodeURIComponent(`/join/${code}`)}`);
  }

  const trip = await getGroupTripByJoinCode(code);
  if (!trip) notFound();

  const result = await joinGroupTripByCode(code);
  if (!result.ok) {
    // Still send them to the trip page — it'll show the real error state
    // (e.g. "you're not part of this trip") rather than a dead end here.
    redirect(`/group-trip/${trip.joinCode}?joinError=${encodeURIComponent(result.error ?? "")}`);
  }

  redirect(`/group-trip/${trip.joinCode}`);
}
