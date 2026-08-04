"use client";

import { PlaceImage } from "@/components/app/PlaceImage";

// A stop's photo block on the trip-plan card — up to 4 gallery images with
// captions (managed in /admin/images), falling back to the single legacy
// photo when a place has no gallery yet. Every place starts with 0 gallery
// rows until an admin fills them in, so the fallback path is the common
// case on day one and must not look broken/empty.
export function StopImageGrid({
  name,
  category,
  images,
  fallbackImageUrl,
  emoji,
  gradient,
}: {
  name: string;
  category: string;
  images: { url: string; caption: string | null }[];
  fallbackImageUrl?: string | null;
  emoji: string;
  gradient: string;
}) {
  if (images.length === 0) {
    return (
      <div className="mt-3 h-40 overflow-hidden rounded-2xl">
        <PlaceImage
          name={name}
          storedSrc={fallbackImageUrl}
          category={category}
          emoji={emoji}
          gradient={gradient}
          className="h-full w-full"
          emojiClassName="text-4xl"
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
            className="h-24 w-full object-cover sm:h-28"
          />
          {img.caption && (
            <figcaption className="line-clamp-2 px-1.5 py-1 text-[10px] font-medium text-slate-600">
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
