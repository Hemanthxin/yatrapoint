import Link from "next/link";
import { redirect } from "next/navigation";
import { BedDouble, MapPin, Star, MapPinned, ExternalLink } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { listHotels, hotelCities } from "@/lib/queries/hotels";
import { formatINR } from "@/lib/format";
import { Filters } from "./Filters";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    city?: string;
    minPrice?: string;
    maxPrice?: string;
    minRating?: string;
    sort?: string;
    page?: string;
  }>;
}

const SORTS = ["price", "-price", "rating", "popular"] as const;
type Sort = (typeof SORTS)[number];

function parseNum(v?: string): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default async function StaysPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "")
    ? (sp.sort as Sort)
    : undefined;

  const [data, cities] = await Promise.all([
    listHotels({
      q: sp.q,
      city: sp.city,
      minPrice: parseNum(sp.minPrice),
      maxPrice: parseNum(sp.maxPrice),
      minRating: parseNum(sp.minRating),
      sort,
      page,
      pageSize: 24,
    }),
    hotelCities(),
  ]);

  // Build a querystring for a given page, preserving all current filters.
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.city) params.set("city", sp.city);
    if (sp.minPrice) params.set("minPrice", sp.minPrice);
    if (sp.maxPrice) params.set("maxPrice", sp.maxPrice);
    if (sp.minRating) params.set("minRating", sp.minRating);
    if (sp.sort) params.set("sort", sp.sort);
    params.set("page", String(p));
    return `/stays?${params.toString()}`;
  };

  // Windowed pagination — cap to ~12 numbered links around the current page.
  const WINDOW = 12;
  let start = 1;
  let end = data.pages;
  if (data.pages > WINDOW) {
    start = Math.max(1, data.page - Math.floor(WINDOW / 2));
    end = start + WINDOW - 1;
    if (end > data.pages) {
      end = data.pages;
      start = end - WINDOW + 1;
    }
  }
  const pageNums = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <BedDouble className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Stays</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {data.total.toLocaleString("en-IN")} hotels &amp; stays — find your night halt
            </p>
          </div>
        </header>

        <Filters
          cities={cities}
          current={{
            q: sp.q,
            city: sp.city,
            minPrice: sp.minPrice,
            maxPrice: sp.maxPrice,
            minRating: sp.minRating,
            sort: sp.sort,
          }}
        />

        {data.rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <BedDouble className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No stays match your search.</p>
            <p className="mt-1 text-sm text-slate-400">Try widening your price range or clearing filters.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.rows.map((h, i) => {
              const stars = h.starRating != null ? Math.max(0, Math.min(5, Math.round(h.starRating))) : 0;
              const place = [h.area, h.city].filter(Boolean).join(", ");
              const hasGeo = Boolean(h.latitude && h.longitude);
              const mapUrl = `https://www.google.com/maps?q=${h.latitude},${h.longitude}`;
              const bookUrl = `https://www.google.com/search?q=${encodeURIComponent(
                `${h.name} ${h.city || ""} hotel booking`
              )}`;
              const chip = h.brand || h.propertyType;

              return (
                <div
                  key={h.id}
                  style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                  className="card-hover animate-fadeUp flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{h.name}</p>
                    {place && (
                      <p className="mt-1 flex items-center gap-1 truncate text-xs font-medium text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{place}</span>
                      </p>
                    )}
                  </div>

                  {/* Ratings row */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {stars > 0 && (
                      <span
                        className="text-sm leading-none text-amber-500"
                        aria-label={`${stars} star hotel`}
                      >
                        {"⭐".repeat(stars)}
                      </span>
                    )}
                    {h.rating != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {h.rating.toFixed(1)}
                      </span>
                    )}
                    {h.reviews != null && h.reviews > 0 && (
                      <span className="text-xs text-slate-400">
                        {h.reviews.toLocaleString("en-IN")} reviews
                      </span>
                    )}
                  </div>

                  {chip && (
                    <div className="mt-2">
                      <span className="inline-block max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {chip}
                      </span>
                    </div>
                  )}

                  {h.nearestLandmark && (
                    <p className="mt-2 flex items-center gap-1 truncate text-xs text-slate-500">
                      <MapPinned className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">Near {h.nearestLandmark}</span>
                    </p>
                  )}

                  {/* Price */}
                  <div className="mt-4">
                    {h.pricePerNight != null ? (
                      <div className="flex flex-wrap items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-900">
                          {formatINR(h.pricePerNight)}
                        </span>
                        <span className="text-xs font-medium text-slate-500">/night</span>
                        {h.taxPerNight != null && h.taxPerNight > 0 && (
                          <span className="ml-1 text-[11px] text-slate-400">
                            + {formatINR(h.taxPerNight)} tax
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">Rate on request</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2">
                    <a
                      href={bookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
                    >
                      Book <ExternalLink className="h-4 w-4" />
                    </a>
                    {hasGeo && (
                      <a
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                      >
                        <MapPin className="h-4 w-4" /> Map
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data.pages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {pageNums.map((n) => {
              const active = n === data.page;
              return (
                <Link
                  key={n}
                  href={qs(n)}
                  aria-current={active ? "page" : undefined}
                  className={`grid h-11 min-w-11 place-items-center rounded-xl px-3 text-sm font-semibold transition active:scale-95 ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {n}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
