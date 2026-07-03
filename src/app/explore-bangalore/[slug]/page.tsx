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
      <div className="animate-fadeUp">
      <BackButton fallback="/explore-bangalore" label="Back" />
      <LocationBanner />

      <article className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-6 md:p-8">
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <p className="relative text-xs font-bold uppercase tracking-wide text-white/90">
            ★ Curated · {place.kind}
          </p>
          <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight text-white drop-shadow sm:text-4xl">
            {place.name}
          </h1>
          <p className="relative mt-1.5 flex items-center gap-1 text-sm font-medium text-white/90">
            <MapPin className="h-4 w-4 shrink-0" />
            {place.area ?? place.city}
          </p>
        </div>

        <div className="p-6 md:p-8">
        <p className="text-sm leading-relaxed text-slate-700">
          {place.description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
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
            className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:scale-[1.02] hover:bg-slate-50 active:scale-95"
          >
            Open in Google Maps <ExternalLink className="h-4 w-4" />
          </a>
          <Link
            href="/budget-planner"
            className="relative inline-flex h-11 items-center overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95"
          >
            <span aria-hidden className="sheen-overlay animate-sheen" />
            <span className="relative">Build a trip including this</span>
          </Link>
        </div>
        </div>
      </article>

      <section className="mt-8">
        <h2 className="mb-1 text-xl font-extrabold tracking-tight text-slate-900">Nearby restaurants</h2>
        <p className="mb-3 text-xs font-medium text-slate-500">
          Live from OpenStreetMap within 1.5 km of {place.name}.
        </p>
        <NearbyRestaurants
          centreLat={Number(place.latitude)}
          centreLng={Number(place.longitude)}
        />
      </section>
      </div>
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}
