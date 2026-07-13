import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cityPlaces } from "@/lib/db/schema";
import { AppShell } from "@/components/app/AppShell";
import { getDashboardStats, listUpcomingTrips } from "@/lib/queries/trip-plans";
import { listDestinations } from "@/lib/queries/destinations";
import { MobileDashboard } from "./MobileDashboard";
import { DesktopDashboard } from "./DesktopDashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const displayName = u.name || u.email || u.phone || "Traveller";
  const firstName = displayName.split(" ")[0] || displayName;

  const stats = await getDashboardStats(u.id ?? "");

  // `citySeed` = a popularity slice of curated city places for the FIRST paint;
  // <NearbyPlaces> then pulls the real nearest ones for the user's location.
  // popular = top Karnataka destinations. Degrade gracefully if the DB times out
  // (Neon is serverless + far away) so a transient hiccup never 500s the page.
  const [citySeed, popularTrips, upcoming] = await Promise.all([
    db.select().from(cityPlaces).orderBy(desc(cityPlaces.popularity)).limit(60).catch(() => []),
    listDestinations({ state: "Karnataka", isHidden: false, limit: 8 }).catch(() => []),
    listUpcomingTrips(u.id ?? ""),
  ]);

  return (
    <AppShell userLabel={displayName} userImage={u.image}>
      {/* ── Mobile (< lg): bespoke app UI ── */}
      <div className="lg:hidden">
        <MobileDashboard
          firstName={firstName}
          stats={stats}
          citySeed={citySeed}
          popularTrips={popularTrips}
        />
      </div>

      {/* ── Desktop (≥ lg): three-column cream + green dashboard ── */}
      <div className="hidden lg:block">
        <DesktopDashboard stats={stats} citySeed={citySeed} upcoming={upcoming} />
      </div>
    </AppShell>
  );
}
