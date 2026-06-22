import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Sparkles,
  Wallet,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { FavoriteButton } from "@/components/app/FavoriteButton";
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
      <Link
        href="/destinations"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> All destinations
      </Link>

      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="relative h-64 md:h-80">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
            <div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${chip}`}
              >
                {cat?.emoji} {cat?.label ?? destination.category}
              </span>
              {destination.isHidden && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
                  <Sparkles className="h-3 w-3" /> Hidden gem
                </span>
              )}
              <h1 className="mt-2 text-4xl font-bold text-white drop-shadow">
                {destination.name}
              </h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-white/90">
                <MapPin className="h-4 w-4" />
                {destination.district
                  ? `${destination.district}, ${destination.state}`
                  : destination.state}
              </p>
            </div>
            <FavoriteButton
              destinationId={destination.id}
              initialFavored={favIds.has(destination.id)}
              size="md"
            />
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-3 md:p-8">
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">About</h2>
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
            <Link
              href={`/budget-planner?destination=${destination.slug}`}
              className="mt-2 block w-full rounded-lg bg-emerald-500 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-600"
            >
              Plan a trip here
            </Link>
            {destination.latitude && destination.longitude && (
              <a
                href={`https://www.google.com/maps?q=${destination.latitude},${destination.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Open in Google Maps
              </a>
            )}
          </aside>
        </div>
      </article>

      {relatedFiltered.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            More {cat?.label ?? "places"} like this
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
