import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { LocationBanner } from "@/components/app/LocationBanner";
import { TripsTabs } from "@/components/app/TripsTabs";
import { listNearby } from "@/lib/queries/nearby";
import { TripsList } from "./TripsList";
import { MobileTrips } from "./MobileTrips";
import { Reveal } from "@/components/app/Reveal";
import { PageHero } from "@/components/app/PageHero";

export default async function OneDayTripsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const trips = await listNearby({ baseCity: "Bangalore" });

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      {/* ── Mobile (< lg): bespoke app UI ── */}
      <div className="lg:hidden">
        <MobileTrips trips={trips} />
      </div>

      {/* ── Desktop (≥ lg): the original list, unchanged ── */}
      <div className="hidden lg:block">
      <Reveal amount={0}>
      <TripsTabs />
      <PageHero
        eyebrow="Weekend-ready"
        icon={Compass}
        title={<>One-day trips <span className="italic">from Bangalore</span></>}
        subtitle={`${trips.length} curated picks, sorted by distance from you.`}
      />

      <LocationBanner />
      <TripsList trips={trips} />
      </Reveal>
      </div>
    </AppShell>
  );
}
