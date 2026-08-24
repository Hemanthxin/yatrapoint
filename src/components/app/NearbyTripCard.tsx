"use client";

import Link from "next/link";
import { Clock, MapPin, Navigation, Wallet } from "lucide-react";
import type { NearbyDestination } from "@/lib/db/schema";
import {
  CATEGORY_BY_SLUG,
  CATEGORY_GRADIENT,
  type CategorySlug,
} from "@/lib/catalog/categories";
import { formatINR } from "@/lib/format";
import { formatKm, formatMinutes } from "@/lib/geo";
import { Reveal } from "./Reveal";
import { PlaceStatusBadgesCompact } from "./PlaceStatusBadges";

interface NearbyTripCardProps {
  destination: NearbyDestination;
  userDistanceKm: number;
  direction?: "up" | "left" | "right";
  delay?: number;
}

export function NearbyTripCard({ destination, userDistanceKm, direction, delay }: NearbyTripCardProps) {
  const cat = CATEGORY_BY_SLUG[destination.category as CategorySlug];
  const gradient =
    CATEGORY_GRADIENT[destination.category as CategorySlug] ??
    "from-slate-400 to-slate-600";

  // Quick estimate: round-trip + time at place + lunch buffer.
  const totalMinutes =
    destination.drivingMinutes * 2 +
    destination.idealHoursAtPlace * 60 +
    60; // food / breaks

  return (
    <Reveal
      as="article"
      direction={direction}
      delay={delay}
      className="card-hover group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-emerald-500/5"
    >
      <Link href={`/one-day-trips/${destination.slug}`} className="relative block">
        <div
          className={`relative grid h-44 w-full place-items-center overflow-hidden bg-gradient-to-br ${gradient}`}
        >
          <span className="text-6xl drop-shadow-md transition duration-500 group-hover:scale-110">
            {cat?.emoji ?? "📍"}
          </span>
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 backdrop-blur">
            {cat?.emoji} {cat?.label ?? destination.category}
          </span>
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
            <Navigation className="h-3 w-3" />
            {formatKm(userDistanceKm)}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="truncate text-lg font-extrabold tracking-tight text-white drop-shadow">
              {destination.name}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-white/85">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                from {destination.baseCity} · {destination.distanceKm} km
              </span>
            </p>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <PlaceStatusBadgesCompact
          rating={destination.googleRating}
          ratingCount={destination.googleRatingCount}
          weeklyHoursJson={destination.googleWeeklyHours}
            businessStatus={destination.googleBusinessStatus}
        />
        <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
          {destination.shortDescription}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <Clock className="h-3.5 w-3.5 text-emerald-600" />
            {formatMinutes(totalMinutes)}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
              destination.entryFeePerPerson > 0
                ? "bg-slate-100 text-slate-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            <Wallet className="h-3.5 w-3.5 text-emerald-600" />
            {destination.entryFeePerPerson > 0
              ? `${formatINR(destination.entryFeePerPerson)} entry`
              : "Free entry"}
          </span>
        </div>
      </div>
    </Reveal>
  );
}
