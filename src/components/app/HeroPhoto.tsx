"use client";

import { useState } from "react";
import Image from "next/image";
import { Expand } from "lucide-react";
import { MediaCarousel } from "@/app/community/MediaCarousel";
import { PhotoLightbox, type LightboxImage } from "./PhotoLightbox";

interface HeroPhotoProps {
  // Gallery photos for the place, in order. Empty when it has none.
  images: LightboxImage[];
  // The single stored photo, used when there is no gallery.
  fallbackImageUrl?: string | null;
  alt: string;
  // Category tile shown when the place has no photo at all.
  emoji: string;
  gradient: string;
}

// A place's hero image, which opens full-screen when tapped.
//
// The hero is a wide crop with the title laid over the bottom of it, so a tall
// photo is mostly cut off and part of what is left sits under text. Tapping it
// now opens the whole picture (see PhotoLightbox); before, tapping did nothing.
//
// Only the PHOTO opens the viewer. The favourite button and the title block are
// separate, absolutely-positioned siblings in the page, so they keep working.
export function HeroPhoto({
  images,
  fallbackImageUrl,
  alt,
  emoji,
  gradient,
}: HeroPhotoProps) {
  const [open, setOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  const lightboxImages: LightboxImage[] =
    images.length > 0 ? images : fallbackImageUrl ? [{ url: fallbackImageUrl }] : [];
  const canOpen = lightboxImages.length > 0;

  return (
    <>
      <div className="absolute inset-0">
        {images.length > 0 ? (
          <MediaCarousel
            media={images.map((g) => ({ url: g.url, kind: "image" as const }))}
            alt={alt}
            className="h-full w-full"
          />
        ) : fallbackImageUrl ? (
          <Image
            src={fallbackImageUrl}
            alt={alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className={`grid h-full w-full place-items-center bg-gradient-to-br ${gradient}`}>
            <span className="text-9xl drop-shadow">{emoji}</span>
          </div>
        )}
      </div>

      {canOpen && (
        <>
          {/* A transparent layer over the photo, under the title/favourite
              controls, so tapping anywhere on the picture opens it. A button
              rather than a click handler on the image so it is reachable by
              keyboard. The carousel's own arrows sit above this. */}
          <button
            type="button"
            onClick={() => {
              setStartIndex(0);
              setOpen(true);
            }}
            aria-label={`View photo of ${alt} full screen`}
            className="group absolute inset-0 cursor-zoom-in"
          >
            <span className="absolute right-4 top-16 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <Expand className="h-3.5 w-3.5" />
              View photo{lightboxImages.length > 1 ? `s (${lightboxImages.length})` : ""}
            </span>
          </button>

          <PhotoLightbox
            images={lightboxImages}
            alt={alt}
            open={open}
            startIndex={startIndex}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </>
  );
}
