import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Sparkles,
  Wallet,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { FavoriteButton } from "@/components/app/FavoriteButton";
import { AddToCartButton } from "@/components/app/AddToCartButton";
import { DestinationCard } from "@/components/app/DestinationCard";
import {
  getDestinationBySlug,
  listDestinations,
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

  const [related, favIds] = await Promise.all([
    listDestinations({
      category: destination.category,
      limit: 4,
    }),
    listFavoriteIds(u.id ?? ""),
  ]);
  const relatedFiltered = related.filter((d) => d.id !== destination.id).slice(0, 3);

  const cat = CATEGORY_BY_SLUG[destination.category as CategorySlug];
  const gradient =
    CATEGORY_GRADIENT[destination.category as CategorySlug] ??
    "from-slate-400 to-slate-600";
  const chip =
    CATEGORY_CHIP[destination.category as CategorySlug] ??
    "bg-slate-100 text-slate-800";

  const tripCost = destination.budgetPerDay * destination.recommendedDays;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp">
      <BackButton fallback="/destinations" label="All destinations" />

      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="relative h-72 sm:h-80 md:h-96">
          {destination.imageUrl ? (
            <Image
              src={destination.imageUrl}
              alt={destination.name}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div
              className={`relative grid h-full w-full place-items-center bg-gradient-to-br ${gradient}`}
            >
              <span className="text-9xl drop-shadow">{cat?.emoji ?? "📍"}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          <div className="absolute right-4 top-4">
            <FavoriteButton
              destinationId={destination.id}
              initialFavored={favIds.has(destination.id)}
              size="md"
            />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
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

        <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-3 md:p-8">
          <div className="md:col-span-2">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">About</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {destination.description}
            </p>
          </div>

          <aside className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
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
            <AddToCartButton
              className="mt-2 w-full py-3 shadow-lg shadow-emerald-500/40"
              label="Plan a trip"
              item={{
                id: `dest-${destination.id}`,
                name: destination.name,
                subtitle: destination.district
                  ? `${destination.district}, ${destination.state}`
                  : destination.state,
                kind: "destination",
                emoji: cat?.emoji ?? "📍",
                href: `/destinations/${destination.slug}`,
              }}
            />
            <Link
              href={`/budget-planner?destination=${destination.slug}`}
              className="block w-full rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-700 transition hover:scale-[1.02] hover:bg-slate-100 active:scale-95"
            >
              Plan in budget planner
            </Link>
            {destination.latitude && destination.longitude && (
              <a
                href={`https://www.google.com/maps?q=${destination.latitude},${destination.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-700 transition hover:scale-[1.02] hover:bg-slate-100 active:scale-95"
              >
                Open in Google Maps
              </a>
            )}
          </aside>
        </div>
      </article>

      {relatedFiltered.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-extrabold tracking-tight text-slate-900">
            More {cat?.label ?? "places"} like this
          </h2>
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
