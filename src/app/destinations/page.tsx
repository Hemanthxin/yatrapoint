import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { DestinationCard } from "@/components/app/DestinationCard";
import { Filters } from "./Filters";
import {
  listDestinations,
  listFavoriteIds,
  listStates,
} from "@/lib/queries/destinations";
import { CATEGORIES } from "@/lib/catalog/categories";

interface PageProps {
  searchParams: Promise<{
    category?: string;
    state?: string;
    q?: string;
    maxBudget?: string;
  }>;
}

export default async function DestinationsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const sp = await searchParams;

  const maxBudget = sp.maxBudget ? Number(sp.maxBudget) : undefined;
  const validCat = CATEGORIES.find((c) => c.slug === sp.category)?.slug;

  const [items, states, favIds] = await Promise.all([
    listDestinations({
      category: validCat,
      state: sp.state,
      query: sp.q,
      maxBudgetPerDay:
        maxBudget && Number.isFinite(maxBudget) ? maxBudget : undefined,
    }),
    listStates(),
    listFavoriteIds(u.id ?? ""),
  ]);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Destinations
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {items.length} {items.length === 1 ? "place" : "places"} matching your
          filters
        </p>
      </header>

      <Filters
        states={states}
        initial={{
          category: validCat,
          state: sp.state,
          q: sp.q,
          maxBudget: maxBudget,
        }}
      />

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-500">
            No destinations match those filters. Try removing one.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((d) => (
            <DestinationCard
              key={d.id}
              destination={d}
              favored={favIds.has(d.id)}
            />
          ))}
        </div>
      )}
      </div>
    </AppShell>
  );
}
