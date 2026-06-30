import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { LocationBanner } from "@/components/app/LocationBanner";
import { TripsTabs } from "@/components/app/TripsTabs";
import { listNearby } from "@/lib/queries/nearby";
import { TripsList } from "./TripsList";

export default async function OneDayTripsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const trips = await listNearby({ baseCity: "Bangalore" });

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp">
      <TripsTabs />
      <header className="mb-4 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
          <Compass className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            One-day trips from{" "}
            <span className="text-gradient animate-shimmer">Bangalore</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {trips.length} curated picks. Sorted by distance from you.
          </p>
        </div>
      </header>

      <LocationBanner />
      <TripsList trips={trips} />
      </div>
    </AppShell>
  );
}
