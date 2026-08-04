"use client";

import { PlaceImage } from "@/components/app/PlaceImage";
import { MediaCarousel } from "@/app/community/MediaCarousel";

// A stop's photo block on the trip-plan card — a large swipeable slideshow
// through the place's gallery (managed in /admin/images, up to 4 images
// with captions), falling back to the single legacy photo when a place has
// no gallery yet. Every place starts with 0 gallery rows until an admin
// fills them in, so the fallback path is the common case on day one and
// must not look broken/empty.
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
      <div className="mt-3 h-48 overflow-hidden rounded-2xl sm:h-56">
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
    <div className="mt-3">
      <MediaCarousel
        media={images.map((img) => ({ url: img.url, kind: "image" }))}
        captions={images.map((img) => img.caption)}
        alt={name}
        className="h-48 overflow-hidden rounded-2xl sm:h-56"
      />
    </div>
  );
}
