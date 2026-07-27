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
import { Reveal } from "@/components/app/Reveal";
import { PageHero } from "@/components/app/PageHero";

export default async function ExploreBangalorePage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  // A small popularity slice just for the FIRST paint (before we know the user's
  // location). Once located, the client pulls the full set of places WITHIN the
  // chosen radius from /api/nearby-places, so nothing nearby is missed — and the
  // page payload stays tiny for a fast load.
  const seed = await db
    .select()
    .from(cityPlaces)
    .orderBy(desc(cityPlaces.popularity))
    .limit(120);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <TripsTabs />

      {/* Mobile (< lg): app-style hero header */}
      <Reveal as="header" className="lg:hidden mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
          <Sparkles className="h-3 w-3" /> Near you
        </span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          Explore <span className="text-gradient">Bengaluru</span>
        </h1>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          Places near you, sorted by distance.
        </p>
      </Reveal>

      {/* Desktop (≥ lg): editorial banner */}
      <div className="hidden lg:block">
        <PageHero
          eyebrow="Near you"
          icon={Sparkles}
          title={<>Explore <span className="italic">Bengaluru</span></>}
          subtitle="Restaurants, malls, temples, parks, museums and more — sorted by distance from you."
        />
      </div>

      <LocationBanner />
      <ExploreClient seed={seed} />
    </AppShell>
  );
}
