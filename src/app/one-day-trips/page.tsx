import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { LocationBanner } from "@/components/app/LocationBanner";
import { TripsTabs } from "@/components/app/TripsTabs";
import { listNearby } from "@/lib/queries/nearby";
import { dedupeCatalogueRows } from "@/lib/place-dedup";
import { TripsList } from "./TripsList";
import { MobileTrips } from "./MobileTrips";
import { Reveal } from "@/components/app/Reveal";
import { PageHero } from "@/components/app/PageHero";

const BASE_CITY = "Bangalore";
// The distance bands the UI offers. A `?within=` value outside this set is
// ignored rather than trusted, so a hand-edited URL can't invent a band.
const DISTANCE_BANDS = [30, 60, 100, 150];

interface PageProps {
  searchParams: Promise<{ within?: string }>;
}

export default async function OneDayTripsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const sp = await searchParams;
  const requested = Number(sp.within);
  const initialMaxDistance = DISTANCE_BANDS.includes(requested) ? requested : 0;

  // Collapse rows that describe the same real spot under slightly different
  // names/coordinates, so a place can't appear twice in the list (BUG-01).
  // Permanently-closed trips are already excluded by listNearby.
  const trips = dedupeCatalogueRows(await listNearby({ baseCity: BASE_CITY }));

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      {/* ── Mobile (< lg): bespoke app UI ── */}
      <div className="lg:hidden">
        <MobileTrips trips={trips} baseCity={BASE_CITY} initialMaxDistance={initialMaxDistance} />
      </div>

      {/* ── Desktop (≥ lg): the original list, unchanged ── */}
      <div className="hidden lg:block">
      <Reveal amount={0}>
      <TripsTabs />
      <PageHero
        eyebrow="Weekend-ready"
        icon={Compass}
        title={<>One-day trips <span className="italic">from {BASE_CITY}</span></>}
        subtitle={`${trips.length} curated picks, sorted by distance from you.`}
        backgroundImage="/pagehero-bg.jpg"
      />

      <LocationBanner />
      <TripsList trips={trips} baseCity={BASE_CITY} initialMaxDistance={initialMaxDistance} />
      </Reveal>
      </div>
    </AppShell>
  );
}
