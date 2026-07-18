import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { DestinationCard } from "@/components/app/DestinationCard";
import { Filters } from "./Filters";
import {
  countDestinations,
  listDestinations,
  listDistricts,
  listFavoriteIds,
  listStates,
} from "@/lib/queries/destinations";
import { CATEGORIES, type CategorySlug } from "@/lib/catalog/categories";
import { ResponsiveSwitch } from "@/components/app/ResponsiveSwitch";
import { MobileDestinations } from "./MobileDestinations";
import { EmptyState } from "@/components/app/EmptyState";
import { NoDataIllustration } from "@/components/illustrations";
import { Pagination } from "./Pagination";

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

  const [items, total, states, districts, favIds] = await Promise.all([
    listDestinations({
      ...destinationFilters,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    countDestinations(destinationFilters),
    listStates(),
    listDistricts(sp.state),
    listFavoriteIds(u.id ?? ""),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          />
        }
        desktop={
          <div className="animate-fadeUp">
      <header className="mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          <span className="text-gradient">Tourist Places</span>
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {total} {total === 1 ? "place" : "places"} matching your filters
        </p>
      </header>

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

      {items.length === 0 ? (
        <EmptyState
          className="mt-8"
          illustration={NoDataIllustration}
          title="No destinations match those filters."
          description="Try removing one to see more places."
        />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 min-[1700px]:grid-cols-6">
            {items.map((d) => (
              <DestinationCard
                key={d.id}
                destination={d}
                favored={favIds.has(d.id)}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} makeHref={pageHref} />
        </>
      )}
          </div>
        }
      />
    </AppShell>
  );
}
