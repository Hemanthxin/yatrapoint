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
import { PlaceImage } from "./PlaceImage";

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
      <Link href={`/one-day-trips/${destination.slug}`} className="relative block h-44 w-full overflow-hidden">
        {/* The card used to paint a flat gradient + emoji here, so a trip with
            a real photo never showed it. Same component as every other card in
            the app now, which also gives it the Wikipedia fallback. */}
        <PlaceImage
          name={destination.name}
          storedSrc={destination.imageUrl}
          hint={destination.baseCity}
          category={destination.category}
          emoji={cat?.emoji ?? "📍"}
          gradient={gradient}
          className="h-full w-full transition duration-500 group-hover:scale-105"
          emojiClassName="text-6xl"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 backdrop-blur">
          {cat?.emoji} {cat?.label ?? destination.category}
        </span>
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
          <Navigation className="h-3 w-3" />
          {formatKm(userDistanceKm)}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* The place name lives in the card BODY, not as white text laid over
            the photo. Overlaid on an arbitrary image it was unreadable — and
            on these cards it was not showing at all, which is what left the
            trips looking anonymous. Dark text on the card cannot fail that
            way, whatever photo the place has. */}
        <div>
          <h3 className="line-clamp-2 text-base font-extrabold leading-snug tracking-tight text-slate-900">
            <Link href={`/one-day-trips/${destination.slug}`} className="hover:underline">
              {destination.name}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              from {destination.baseCity} · {destination.distanceKm} km
            </span>
          </p>
        </div>

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
