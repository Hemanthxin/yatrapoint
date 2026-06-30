import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cityPlaces } from "@/lib/db/schema";
import { AppShell } from "@/components/app/AppShell";
import { LocationBanner } from "@/components/app/LocationBanner";
import { TripsTabs } from "@/components/app/TripsTabs";
import { ExploreClient } from "./ExploreClient";

export default async function ExploreBangalorePage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  // Server-side curated seed list — passed to the client so it always has
  // something to render before/after the Overpass call.
  const seed = await db.select().from(cityPlaces);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <TripsTabs />
      <header className="mb-4 flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            <span className="text-gradient">Explore Bengaluru</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {seed.length} curated picks plus live OpenStreetMap data — restaurants, malls,
            temples, parks, museums, nightlife, all sorted by distance from you.
          </p>
        </div>
      </header>

      <LocationBanner />
      <ExploreClient seed={seed} />
    </AppShell>
  );
}
