import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { DestinationCard } from "@/components/app/DestinationCard";
import { SearchResultCard } from "@/components/app/SearchResultCard";
import { RevealGrid } from "@/components/app/RevealGrid";
import { Filters } from "./Filters";
import {
  countDestinations,
  listDestinations,
  listDistricts,
  listFavoriteIds,
  listStates,
} from "@/lib/queries/destinations";
import { listCityPlacesByCategory } from "@/lib/queries/city-places";
import { listNearby } from "@/lib/queries/nearby";
import { db } from "@/lib/db";
import { searchPlaces, toDestination } from "@/lib/queries/places";
import { CATEGORIES, type CategorySlug } from "@/lib/catalog/categories";
import { ResponsiveSwitch } from "@/components/app/ResponsiveSwitch";
import { MobileDestinations } from "./MobileDestinations";
import { EmptyState } from "@/components/app/EmptyState";
import { NoDataIllustration } from "@/components/illustrations";
import { Pagination } from "./Pagination";
import { Reveal } from "@/components/app/Reveal";
import { PageHero } from "@/components/app/PageHero";
import { Compass } from "lucide-react";

const PAGE_SIZE = 48;

interface PageProps {
  searchParams: Promise<{
    category?: string;
    state?: string;
    district?: string;
    q?: string;
    maxBudget?: string;
    page?: string;
  }>;
}

export default async function DestinationsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const sp = await searchParams;

  const maxBudget = sp.maxBudget ? Number(sp.maxBudget) : undefined;
  const validCat = CATEGORIES.find((c) => c.slug === sp.category)?.slug;
  const page = Math.max(1, Number(sp.page) || 1);

  const destinationFilters = {
    category: validCat,
    state: sp.state,
    district: sp.district,
    query: sp.q,
    maxBudgetPerDay:
      maxBudget && Number.isFinite(maxBudget) ? maxBudget : undefined,
  };

  const q = sp.q?.trim();

  // A TEXT SEARCH is answered by one ranked query over the whole catalogue.
  //
  // It used to be three separate `%q%` lookups — destinations, city places and
  // day trips — each ordered by popularity and rendered as its own section. So
  // a search for "Mysore" split the city's own attractions across three lists,
  // ordered by how popular each was rather than how well it matched, and missed
  // everything filed under the "Mysuru" spelling. One list, ranked by
  // relevance, is both simpler and what a traveller expects.
  const searchResults = q ? await searchPlaces(db, q, { limit: PAGE_SIZE }) : [];

  // A CATEGORY filter still pulls the supplementary sections, which are useful
  // when browsing rather than searching.
  const cityMatchesPromise = !q && validCat ? listCityPlacesByCategory(validCat, 12) : Promise.resolve([]);
  const nearbyMatchesPromise = !q && validCat ? listNearby({ category: validCat, limit: 12 }) : Promise.resolve([]);

  const [browseItems, browseTotal, states, districts, favIds, cityMatches, nearbyMatches] =
    await Promise.all([
      q
        ? Promise.resolve([])
        : listDestinations({
            ...destinationFilters,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
          }),
      q ? Promise.resolve(0) : countDestinations(destinationFilters),
      listStates(),
      listDistricts(sp.state),
      listFavoriteIds(u.id ?? ""),
      cityMatchesPromise,
      nearbyMatchesPromise,
    ]);

  const items = q ? searchResults.map((r) => toDestination(r.place)) : browseItems;
  const total = q ? searchResults.length : browseTotal;
  const totalPages = q ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Category quick-filters — the old "Trips by Places" browse, folded into the
  // State page so every kind of trip is reachable from one place. Changing a
  // filter always resets to page 1 (no `page` param carried over).
  function catHref(slug?: CategorySlug) {
    const next = new URLSearchParams();
    if (sp.state) next.set("state", sp.state);
    if (sp.district) next.set("district", sp.district);
    if (sp.q) next.set("q", sp.q);
    if (sp.maxBudget) next.set("maxBudget", sp.maxBudget);
    if (slug) next.set("category", slug);
    const qs = next.toString();
    return qs ? `/destinations?${qs}` : "/destinations";
  }

  // Same filters, different page — for the pager.
  function pageHref(p: number) {
    const next = new URLSearchParams();
    if (sp.state) next.set("state", sp.state);
    if (sp.district) next.set("district", sp.district);
    if (sp.q) next.set("q", sp.q);
    if (sp.maxBudget) next.set("maxBudget", sp.maxBudget);
    if (validCat) next.set("category", validCat);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/destinations?${qs}` : "/destinations";
  }

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <ResponsiveSwitch
        mobile={
          <MobileDestinations
            items={items}
            total={total}
            favIds={favIds}
            states={states}
            districts={districts}
            validCat={validCat}
            sp={sp}
            maxBudget={maxBudget}
            page={page}
            totalPages={totalPages}
            pageHref={pageHref}
            cityMatches={cityMatches}
            nearbyMatches={nearbyMatches}
          />
        }
        desktop={
          <Reveal amount={0}>
      <PageHero
        eyebrow="Explore India"
        icon={Compass}
        title={<>Tourist <span className="italic">Places</span></>}
        subtitle={`${total} curated ${total === 1 ? "place" : "places"} matching your filters — from heritage forts to hidden waterfalls.`}
        backgroundImage="/pagehero-bg.jpg"
      />

      {/* Trips by place-type — quick category chips (folded in from the old
          "Trips by Places" page). */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={catHref(undefined)}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
            !validCat
              ? "border-transparent bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          All places
        </Link>
        {CATEGORIES.map((c) => {
          const on = validCat === c.slug;
          return (
            <Link
              key={c.slug}
              href={catHref(c.slug)}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                on
                  ? "border-transparent bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{c.emoji}</span>
              {c.label}
            </Link>
          );
        })}
      </div>

      <Filters
        states={states}
        districts={districts}
        initial={{
          category: validCat,
          state: sp.state,
          district: sp.district,
          q: sp.q,
          maxBudget: maxBudget,
        }}
      />

      {items.length === 0 && cityMatches.length === 0 && nearbyMatches.length === 0 ? (
        <EmptyState
          className="mt-8"
          illustration={NoDataIllustration}
          title="No destinations match those filters."
          description="Try removing one to see more places."
        />
      ) : (
        <>
          {items.length > 0 && (
            <>
              <RevealGrid className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 min-[1700px]:grid-cols-6">
                {items.map((d) => (
                  <DestinationCard
                    key={d.id}
                    destination={d}
                    favored={favIds.has(d.id)}
                  />
                ))}
              </RevealGrid>
              <Pagination page={page} totalPages={totalPages} makeHref={pageHref} />
            </>
          )}

          {/* Matches from other catalogues — a text search shouldn't be
              limited to the main destinations table. */}
          {cityMatches.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-serif text-xl font-semibold text-slate-900">
                In Bengaluru — restaurants, malls & more
              </h2>
              <RevealGrid className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 min-[1700px]:grid-cols-6">
                {cityMatches.map((c) => (
                  <SearchResultCard
                    key={c.id}
                    href={`/explore-bangalore/${c.slug}`}
                    name={c.name}
                    subtitle={[c.area, c.city].filter(Boolean).join(", ")}
                    shortDescription={c.shortDescription}
                    imageUrl={c.imageUrl}
                    badge={c.kind}
                  />
                ))}
              </RevealGrid>
            </section>
          )}

          {nearbyMatches.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-serif text-xl font-semibold text-slate-900">One-day trips</h2>
              <RevealGrid className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 min-[1700px]:grid-cols-6">
                {nearbyMatches.map((n) => (
                  <SearchResultCard
                    key={n.id}
                    href={`/one-day-trips/${n.slug}`}
                    name={n.name}
                    subtitle={`from ${n.baseCity} · ${n.distanceKm} km`}
                    shortDescription={n.shortDescription}
                    imageUrl={n.imageUrl}
                    badge="Nearby trip"
                  />
                ))}
              </RevealGrid>
            </section>
          )}
        </>
      )}
          </Reveal>
        }
      />
    </AppShell>
  );
}
