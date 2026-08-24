"use client";

import { PlaceImage } from "@/components/app/PlaceImage";

// A stop's photo block on the trip-plan card — a row/grid of the place's
// gallery photos (managed in /admin/images, up to 4 images with captions),
// all visible at once with a caption under each, falling back to the
// single legacy photo when a place has no gallery yet. Every place starts
// with 0 gallery rows until an admin fills them in, so the fallback path is
// the common case on day one and must not look broken/empty.
export function StopImageGrid({
  name,
  category,
  images,
  fallbackImageUrl,
  emoji,
  gradient,
  locationHint,
}: {
  name: string;
  category: string;
  images: { url: string; caption: string | null }[];
  fallbackImageUrl?: string | null;
  emoji: string;
  gradient: string;
  // Nearby place/area name, used to disambiguate a generic place name when
  // resolving a photo (e.g. two "Nataraja Temple"s in different towns).
  locationHint?: string;
}) {
  if (images.length === 0) {
    return (
      <div className="mt-3 h-48 overflow-hidden rounded-2xl sm:h-56">
        <PlaceImage
          name={name}
          storedSrc={fallbackImageUrl}
          hint={locationHint}
          category={category}
          emoji={emoji}
          gradient={gradient}
          className="h-full w-full"
          emojiClassName="text-4xl"
          // BUG-03: a live-API stop with no photo used to show nothing but a
          // coloured tile. A plan has a handful of stops (not the hundreds of
          // cards a catalogue page renders), so resolving a real, name-matched
          // Wikipedia photo per stop is affordable here and is the reliable,
          // licence-safe image source the report asked for.
          preferWiki
        />
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {images.map((img, i) => (
        <figure key={i} className="overflow-hidden rounded-xl bg-slate-100">
          {/* Already-known-good stored data URLs — no need for PlaceImage's
              error-fallback chain here, that's for the single hero photo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.caption || name}
            loading="lazy"
            className="h-32 w-full object-cover sm:h-36"
          />
          {img.caption && (
            <figcaption className="line-clamp-2 px-1.5 py-1 text-[11px] font-medium text-slate-600">
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
