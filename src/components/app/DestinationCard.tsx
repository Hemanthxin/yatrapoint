import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";
import type { Destination } from "@/lib/db/schema";
import {
  CATEGORY_BY_SLUG,
  CATEGORY_CHIP,
  CATEGORY_GRADIENT,
  type CategorySlug,
} from "@/lib/catalog/categories";
import { FavoriteButton } from "./FavoriteButton";
import { AddToCartButton } from "./AddToCartButton";
import { PlaceImage } from "./PlaceImage";
import { Reveal } from "./Reveal";

interface DestinationCardProps {
  destination: Destination;
  favored?: boolean;
  direction?: "up" | "left" | "right";
  delay?: number;
}

export function DestinationCard({ destination, favored, direction, delay }: DestinationCardProps) {
  const cat = CATEGORY_BY_SLUG[destination.category as CategorySlug];
  const gradient =
    CATEGORY_GRADIENT[destination.category as CategorySlug] ??
    "from-slate-400 to-slate-600";
  const chip =
    CATEGORY_CHIP[destination.category as CategorySlug] ??
    "bg-slate-100 text-slate-800";

  return (
    <Reveal
      as="article"
      direction={direction}
      delay={delay}
      className="card card-hover group flex flex-col overflow-hidden"
    >
      <Link
        href={`/destinations/${destination.slug}`}
        className="relative block aspect-[4/3] w-full overflow-hidden"
      >
        <PlaceImage
          name={destination.name}
          storedSrc={destination.imageUrl}
          hint={[destination.district, destination.state].filter(Boolean).join(", ")}
          category={destination.category}
          emoji={cat?.emoji ?? "📍"}
          gradient={gradient}
          className="h-full w-full transition duration-500 group-hover:scale-105"
          emojiClassName="text-6xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${chip}`}
        >
          {cat?.emoji} {cat?.label ?? destination.category}
        </span>
        {destination.isHidden && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <Sparkles className="h-3 w-3" /> Hidden gem
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="truncate text-base font-extrabold tracking-tight text-white drop-shadow">
            {destination.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-white/85">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {destination.district
                ? `${destination.district}, ${destination.state}`
                : destination.state}
            </span>
          </p>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 flex-1 text-sm text-slate-600">
            {destination.shortDescription}
          </p>
          <FavoriteButton
            destinationId={destination.id}
            initialFavored={!!favored}
          />
        </div>

        <AddToCartButton
          className="mt-auto w-full py-2.5 shadow-lg shadow-emerald-500/40"
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
      </div>
    </Reveal>
  );
}
