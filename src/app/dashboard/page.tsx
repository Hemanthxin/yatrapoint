import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { getDashboardStats, listUpcomingTrips } from "@/lib/queries/trip-plans";
import { listDestinations } from "@/lib/queries/destinations";
import { listPopularCityPlaces } from "@/lib/queries/city-places";
import { MobileDashboard } from "./MobileDashboard";
import { DashboardIntro } from "@/components/app/dashboard/DashboardIntro";
import { Dashboard3DRoot } from "@/components/app/dashboard3d/Dashboard3DRoot";

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

  return (
    <AppShell userLabel={displayName} userImage={u.image} spatial>
      {/* ── Mobile (< lg): bespoke app UI, unchanged ── */}
      <div className="lg:hidden">
        <DashboardIntro />
        <MobileDashboard
          firstName={firstName}
          stats={stats}
          citySeed={citySeed}
          popularTrips={popularTrips}
        />
      </div>

      {/* ── Desktop (≥ lg): the 3D spatial dashboard, built from real CSS 3D
          transforms + Framer Motion (no WebGL — see dashboard3d/Dashboard3DRoot
          for why react-three-fiber didn't work out here) ── */}
      <div className="hidden h-full lg:block">
        <Dashboard3DRoot firstName={firstName} stats={stats} upcoming={upcoming} citySeed={citySeed} />
      </div>
    </AppShell>
  );
}
