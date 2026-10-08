import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { getDashboardStats, listUpcomingTrips } from "@/lib/queries/trip-plans";
import { listDestinations } from "@/lib/queries/destinations";
import { listPopularCityPlaces } from "@/lib/queries/city-places";
import { MobileDashboard } from "./MobileDashboard";
import { DashboardIntro } from "@/components/app/dashboard/DashboardIntro";
import { DashboardHome } from "@/components/app/home/DashboardHome";
import { ResponsiveSwitch } from "@/components/app/ResponsiveSwitch";
import { JourneyStory } from "@/components/app/journey/JourneyStory";
import { daysUntil, festivalsByNextOccurrence, formatFestivalDate } from "@/lib/festivals";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const displayName = u.name || u.email || u.phone || "Traveller";
  const firstName = displayName.split(" ")[0] || displayName;

  // `citySeed` = a popularity slice of curated city places for the FIRST paint;
  // <NearbyPlaces> then pulls the real nearest ones for the user's location.
  // popular = top Karnataka destinations. Degrade gracefully if the DB times out
  // (Neon is serverless + far away) so a transient hiccup never 500s the page.
  // `stats` used to be awaited on its own line before this batch even though
  // nothing here depends on it — on the very first page after login, that's a
  // whole extra Neon round-trip (measured at 200ms+ each) added to every load
  // for no reason. It's independent, so it belongs in the same Promise.all.
  const [stats, citySeed, popularTrips, upcoming] = await Promise.all([
    getDashboardStats(u.id ?? ""),
    listPopularCityPlaces(60).catch(() => []),
    listDestinations({ state: "Karnataka", isHidden: false, limit: 8 }).catch(() => []),
    listUpcomingTrips(u.id ?? ""),
  ]);

  // The journey story's "Festival Village" station: the genuinely next festival.
  const nextFest = festivalsByNextOccurrence()[0];
  const festival = nextFest
    ? { name: nextFest.name, dateLabel: formatFestivalDate(nextFest.nextISO), emoji: nextFest.emoji, days: daysUntil(nextFest.nextISO) }
    : null;

  return (
    <AppShell userLabel={displayName} userImage={u.image}>
      {/* Only ONE of these ever mounts. Hiding the other with CSS isn't enough: a
          hidden tree still runs its effects, measures itself as 0×0, fires its API
          calls and preloads its images — which is how a hidden desktop story once
          crashed the whole page on narrow windows. */}
      <ResponsiveSwitch
        mobile={
          // Mobile (< lg): bespoke app UI, unchanged
          <>
            <DashboardIntro />
            <MobileDashboard firstName={firstName} stats={stats} citySeed={citySeed} popularTrips={popularTrips} />
          </>
        }
        desktop={
          // Desktop (≥ lg): the normal app shell (sidebar kept) around a painted basecamp that
          // welcomes the traveller by the real time of day, a "today" row of live cards, and —
          // below — a scroll-driven story of their journey
          <div className="space-y-10">
            <DashboardHome firstName={firstName} stats={stats} upcoming={upcoming} festival={festival} />
            <JourneyStory firstName={firstName} stats={stats} festival={festival} />
          </div>
        }
      />
    </AppShell>
  );
}
