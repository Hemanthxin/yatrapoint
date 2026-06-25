import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  Clock,
  ExternalLink,
  MapPin,
  Tag,
  Wallet,
} from "lucide-react";

import { BackButton } from "@/components/app/BackButton";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cityPlaces } from "@/lib/db/schema";
import { AppShell } from "@/components/app/AppShell";
import { LocationBanner } from "@/components/app/LocationBanner";
import { NearbyRestaurants } from "./NearbyRestaurants";
import { formatINR } from "@/lib/format";
import { formatMinutes } from "@/lib/geo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CityPlacePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  const { slug } = await params;

  const [place] = await db
    .select()
    .from(cityPlaces)
    .where(eq(cityPlaces.slug, slug))
    .limit(1);
  if (!place) notFound();

  const tags = place.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <BackButton fallback="/explore-bangalore" label="Back" />
      <LocationBanner />

      <article className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          ★ Curated · {place.kind}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">{place.name}</h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
          <MapPin className="h-4 w-4" />
          {place.area ?? place.city}
        </p>

        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          {place.description}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {place.entryFeePerPerson > 0 && (
            <Fact
              icon={<Wallet className="h-4 w-4" />}
              label="Entry"
              value={`${formatINR(place.entryFeePerPerson)} / person`}
            />
          )}
          {place.avgCostForTwo != null && (
            <Fact
              icon={<Wallet className="h-4 w-4" />}
              label="Cost for two"
              value={formatINR(place.avgCostForTwo)}
            />
          )}
          <Fact
            icon={<Clock className="h-4 w-4" />}
            label="Open"
            value={
              place.openTime && place.closeTime
                ? `${place.openTime}–${place.closeTime}${
                    place.openDays ? ` · ${place.openDays}` : ""
                  }`
                : "Varies"
            }
          />
          <Fact
            icon={<MapPin className="h-4 w-4" />}
            label="Typical stay"
            value={formatMinutes(place.idealMinutesAtPlace)}
          />
        </div>

        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
              >
                <Tag className="h-3 w-3" />
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Open in Google Maps <ExternalLink className="h-3 w-3" />
          </a>
          <Link
            href="/budget-planner"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
          >
            Build a trip including this
          </Link>
        </div>
      </article>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Nearby restaurants</h2>
        <p className="mb-3 text-xs text-slate-500">
          Live from OpenStreetMap within 1.5 km of {place.name}.
        </p>
        <NearbyRestaurants
          centreLat={Number(place.latitude)}
          centreLng={Number(place.longitude)}
        />
      </section>
    </AppShell>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
