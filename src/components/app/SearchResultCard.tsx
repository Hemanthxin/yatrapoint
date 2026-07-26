import Link from "next/link";
import { MapPin } from "lucide-react";
import { PlaceImage } from "./PlaceImage";
import { Reveal } from "./Reveal";

interface SearchResultCardProps {
  href: string;
  name: string;
  subtitle: string;
  shortDescription: string;
  imageUrl?: string | null;
  emoji?: string;
  gradient?: string;
  badge: string;
  direction?: "up" | "left" | "right";
  delay?: number;
}

// Lightweight read-only preview card for cross-table search results (city
// places, nearby trips) — visually consistent with DestinationCard but
// without cart/favorite actions, since those concepts don't apply the same
// way outside the main destinations catalogue.
export function SearchResultCard({
  href,
  name,
  subtitle,
  shortDescription,
  imageUrl,
  emoji = "📍",
  gradient = "from-slate-400 to-slate-600",
  badge,
  direction,
  delay,
}: SearchResultCardProps) {
  return (
    <Reveal
      as="article"
      direction={direction}
      delay={delay}
      className="card card-hover group flex flex-col overflow-hidden"
    >
      <Link href={href} className="relative block aspect-[4/3] w-full overflow-hidden">
        <PlaceImage
          name={name}
          storedSrc={imageUrl}
          hint={subtitle}
          emoji={emoji}
          gradient={gradient}
          className="h-full w-full transition duration-500 group-hover:scale-105"
          emojiClassName="text-6xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800">
          {badge}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="truncate text-base font-extrabold tracking-tight text-white drop-shadow">{name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-white/85">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{subtitle}</span>
          </p>
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <p className="line-clamp-2 flex-1 text-sm text-slate-600">{shortDescription}</p>
      </div>
    </Reveal>
  );
}
