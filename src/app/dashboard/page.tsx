import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { getDashboardStats, listUpcomingTrips } from "@/lib/queries/trip-plans";
import { listNearby } from "@/lib/queries/nearby";
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

  // Real data: nearby = one-day trips from Bangalore; popular = top Karnataka
  // destinations by popularity. Degrade gracefully if the DB times out (Neon is
  // serverless + far away) so a transient hiccup never 500s the home page.
  const [nearbyRows, popularTrips, upcoming] = await Promise.all([
    listNearby({ baseCity: "Bangalore" }).catch(() => []),
    listDestinations({ state: "Karnataka", isHidden: false, limit: 8 }).catch(() => []),
    listUpcomingTrips(u.id ?? ""),
  ]);
  const nearby = nearbyRows.slice(0, 8);

  return (
    <AppShell userLabel={displayName} userImage={u.image}>
      {/* ── Mobile (< lg): bespoke app UI ── */}
      <div className="lg:hidden">
        <MobileDashboard
          firstName={firstName}
          stats={stats}
          nearby={nearby}
          popularTrips={popularTrips}
        />
      </div>

      {/* ── Desktop (≥ lg): three-column cream + green dashboard ── */}
      <div className="hidden lg:block">
        <DesktopDashboard stats={stats} nearby={nearby} upcoming={upcoming} />
      </div>
    </AppShell>
  );
}
