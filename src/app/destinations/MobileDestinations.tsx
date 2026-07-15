import Link from "next/link";
import { Compass, MapPin, SlidersHorizontal } from "lucide-react";

import { DestinationCard } from "@/components/app/DestinationCard";
import { CATEGORIES, type CategorySlug } from "@/lib/catalog/categories";
import type { Destination } from "@/lib/db/schema";
import { Filters } from "./Filters";
import { Pagination } from "./Pagination";

interface Props {
  items: Destination[];
  total: number;
  favIds: Set<string>;
  states: string[];
  districts: string[];
  validCat?: CategorySlug;
  sp: {
    category?: string;
    state?: string;
    district?: string;
    q?: string;
    maxBudget?: string;
  };
  maxBudget?: number;
  page: number;
  totalPages: number;
  pageHref: (page: number) => string;
}

// A bespoke, app-first mobile layout for the Destinations / State screen.
// Rendered only below `lg`. Coral accent comes automatically from the mobile
// theme, so every `emerald`/`green` utility here paints coral on phones.
export function MobileDestinations({
  items,
  total,
  favIds,
  states,
  districts,
  validCat,
  sp,
  maxBudget,
  page,
  totalPages,
  pageHref,
}: Props) {
  // Build a category-chip href that preserves the other active filters.
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

  return (
    <div className="space-y-5 pb-4">
      {/* Bold header */}
      <header className="animate-fadeUp">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500">
          <Compass className="h-4 w-4 text-emerald-600" /> Explore India
        </p>
        <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-slate-900">
          Destinations
        </h1>
        <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
          {total} {total === 1 ? "place" : "places"} matching your filters
        </p>
      </header>

      {/* Category chip rail */}
      <div className="animate-fadeUp no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
        <Link
          href={catHref(undefined)}
          className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
            !validCat
              ? "border-transparent bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30"
              : "border-slate-200 bg-white text-slate-600"
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
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                on
                  ? "border-transparent bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <span>{c.emoji}</span>
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* Reused Filters — labelled for the mobile context */}
      <div className="animate-fadeUp">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-700">
          <SlidersHorizontal className="h-4 w-4 text-emerald-600" /> Refine
        </p>
        <Filters
          states={states}
          districts={districts}
          hideCategory
          initial={{
            category: validCat,
            state: sp.state,
            district: sp.district,
            q: sp.q,
            maxBudget: maxBudget,
          }}
        />
      </div>

      {/* Feed of place cards */}
      {items.length === 0 ? (
        <div className="animate-fadeUp mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-3xl">
            🧭
          </div>
          <p className="mt-3 text-base font-bold text-slate-800">Nothing here yet</p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            No destinations match those filters. Try removing one.
          </p>
          <Link
            href="/destinations"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 active:scale-95"
          >
            Reset filters
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {items.map((d) => (
              <DestinationCard key={d.id} destination={d} favored={favIds.has(d.id)} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} makeHref={pageHref} />
        </>
      )}
    </div>
  );
}
