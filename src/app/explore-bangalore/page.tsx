import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
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

  // Server-side curated seed list — the catalogue has ~10k rows; shipping all of
  // them to the client made this page slow, so we send the top 500 by popularity
  // (the client then sorts those by distance from the user). Live nearby places
  // still stream in from Overpass when a category is selected.
  const seed = await db
    .select()
    .from(cityPlaces)
    .orderBy(desc(cityPlaces.popularity))
    .limit(500);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <TripsTabs />

      {/* Mobile (< lg): app-style hero header */}
      <header className="lg:hidden mb-4 animate-fadeUp">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
          <Sparkles className="h-3 w-3" /> Near you
        </span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          Explore <span className="text-gradient">Bengaluru</span>
        </h1>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          {seed.length} curated + live picks, sorted by distance from you.
        </p>
      </header>

      {/* Desktop (≥ lg): original header, unchanged */}
      <header className="mb-4 hidden items-start gap-3 lg:flex">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
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
