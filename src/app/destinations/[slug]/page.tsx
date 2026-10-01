import { notFound, redirect } from "next/navigation";
import {
  Calendar,
  MapPin,
  Sparkles,
  Wallet,
  Users,
  Ticket,
  ExternalLink,
  Info,
} from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { FavoriteButton } from "@/components/app/FavoriteButton";
import { LocationBanner } from "@/components/app/LocationBanner";
import { DestinationCard } from "@/components/app/DestinationCard";
import { DestinationDetail } from "./DestinationDetail";
import { Reveal } from "@/components/app/Reveal";
import { HeroPhoto } from "@/components/app/HeroPhoto";
import { MobileDetail } from "./MobileDetail";
import { IMAGE_SOURCE } from "@/lib/queries/admin-images";
import { listGalleryImages } from "@/lib/queries/place-gallery";
import { listNearbyPoi } from "@/lib/queries/nearby-poi";
import { db } from "@/lib/db";
import { PlaceStatusBadgesFull } from "@/components/app/PlaceStatusBadges";
import {
  getDestinationBySlug,
  listDestinationsNear,
  listFavoriteIds,
} from "@/lib/queries/destinations";
import { formatINR, formatBestMonths, formatDays } from "@/lib/format";
import {
  CATEGORY_BY_SLUG,
  CATEGORY_CHIP,
  CATEGORY_GRADIENT,
  type CategorySlug,
} from "@/lib/catalog/categories";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DestinationPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const { slug } = await params;

  const destination = await getDestinationBySlug(slug);
  if (!destination) notFound();

  // Genuinely NEARBY places, nearest first — not the most popular places of the
  // same category anywhere in India, which is what this used to show (BUG-07).
  // Food and shopping come from our own catalogue, seeded from OpenStreetMap by
  // scripts/seed-nearby-poi.ts. Reading them here rather than calling Overpass
  // from the browser is what makes the Food and Shopping tabs work at all: the
  // public mirrors are too slow and too rate-limited to answer a page render.
  // A live lookup still runs client-side and merges in anything extra.
  const poiLat = Number(destination.latitude);
  const poiLng = Number(destination.longitude);

  const [relatedFiltered, favIds, gallery, seededPoi] = await Promise.all([
    listDestinationsNear(destination, { radiusKm: 150, limit: 3 }),
    listFavoriteIds(u.id ?? ""),
    listGalleryImages(destination.id, IMAGE_SOURCE),
    Number.isFinite(poiLat) && Number.isFinite(poiLng)
      ? listNearbyPoi(db, poiLat, poiLng, 5)
      : Promise.resolve({ food: [], shopping: [] }),
  ]);

  const cat = CATEGORY_BY_SLUG[destination.category as CategorySlug];
  const gradient =
    CATEGORY_GRADIENT[destination.category as CategorySlug] ??
    "from-slate-400 to-slate-600";
  const chip =
    CATEGORY_CHIP[destination.category as CategorySlug] ??
    "bg-slate-100 text-slate-800";

  const tripCost = destination.budgetPerDay * destination.recommendedDays;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image} immersive>
      {/* ── Mobile (< lg): bespoke place screen ── */}
      <div className="lg:hidden">
        <MobileDetail
          place={destination}
          gallery={gallery}
          nearby={relatedFiltered}
          favored={favIds.has(destination.id)}
          seededPoi={seededPoi}
        />
      </div>

      {/* ── Desktop (≥ lg): the original layout, unchanged ── */}
      <div className="hidden lg:block">
      <Reveal amount={0}>
      <BackButton fallback="/destinations" label="All destinations" />

      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="relative h-72 sm:h-80 md:h-96">
          <HeroPhoto
            images={gallery.map((g) => ({ url: g.url, caption: g.caption }))}
            fallbackImageUrl={destination.imageUrl}
            alt={destination.name}
            emoji={cat?.emoji ?? "📍"}
            gradient={gradient}
            preferWiki
            hint={[destination.district, destination.state].filter(Boolean).join(", ")}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          <div className="absolute right-4 top-4">
            <FavoriteButton
              destinationId={destination.id}
              initialFavored={favIds.has(destination.id)}
              size="md"
            />
          </div>

          {/* pointer-events-none so a tap on the title area still reaches the
              photo underneath and opens it — this block covers the lower half
              of the hero and holds nothing clickable. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${chip}`}
              >
                {cat?.emoji} {cat?.label ?? destination.category}
              </span>
              {destination.isHidden && (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  <Sparkles className="h-3 w-3" /> Hidden gem
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white drop-shadow sm:text-4xl">
              {destination.name}
            </h1>
            <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-white/90">
              <MapPin className="h-4 w-4 shrink-0" />
              {destination.district
                ? `${destination.district}, ${destination.state}`
                : destination.state}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 md:p-8">
          <PlaceStatusBadgesFull
            rating={destination.googleRating}
            ratingCount={destination.googleRatingCount}
            weeklyHoursJson={destination.googleWeeklyHours}
            businessStatus={destination.googleBusinessStatus}
            className="mb-5"
          />
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">About</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {destination.description}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
            <Stat
              icon={<Wallet className="h-4 w-4" />}
              label="Per day (mid-range)"
              value={formatINR(destination.budgetPerDay)}
            />
            <Stat
              icon={<Calendar className="h-4 w-4" />}
              label="Recommended"
              value={formatDays(destination.recommendedDays)}
            />
            <Stat
              icon={<Sparkles className="h-4 w-4" />}
              label="Best time to visit"
              value={formatBestMonths(destination.bestMonths)}
            />
            <Stat
              icon={<Users className="h-4 w-4" />}
              label="Typical trip cost"
              value={`${formatINR(tripCost)} pp`}
            />
          </div>

          {(destination.entryFeesForeigner != null || destination.entryFeesChild != null) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                Entry fee — Indian: {destination.entryFees === 0 ? "Free" : formatINR(destination.entryFees)}
              </span>
              {destination.entryFeesForeigner != null && (
                <span>Foreigner: {formatINR(destination.entryFeesForeigner)}</span>
              )}
              {destination.entryFeesChild != null && (
                <span>Child: {formatINR(destination.entryFeesChild)}</span>
              )}
            </div>
          )}

          {destination.bookingUrl && (
            <a
              href={destination.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.02] active:scale-95"
            >
              <Ticket className="h-4 w-4" /> Book tickets
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {destination.visitorGuidelines && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-amber-800">
                <Info className="h-4 w-4" /> Know before you go
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-amber-900">
                {destination.visitorGuidelines}
              </p>
            </div>
          )}
        </div>
      </article>

      {/* Live route + live budget + timeline, plus the Plan a trip action. */}
      <div className="mt-4">
        <LocationBanner />
      </div>
      <DestinationDetail destination={destination} />

      {relatedFiltered.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 text-xl font-extrabold tracking-tight text-slate-900">
            Nearby places
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Other places close to {destination.name}, nearest first.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            {relatedFiltered.map((d) => (
              <DestinationCard
                key={d.id}
                destination={d}
                favored={favIds.has(d.id)}
              />
            ))}
          </div>
        </section>
      )}
      </Reveal>
      </div>
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        {icon}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
