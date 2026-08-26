"use client";

import { useEffect, useState } from "react";
import { Expand } from "lucide-react";
import { MediaCarousel } from "@/app/community/MediaCarousel";
import { resolvePlaceImage } from "@/lib/actions/place-image";
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
  // Look the place up on Wikipedia when it has no photo of its own. Detail
  // pages render ONE place, so the lookup is cheap here — unlike a catalogue
  // grid, where doing it per card would fire hundreds of requests.
  preferWiki?: boolean;
  // Nearby place/area, used to disambiguate a generic name in that lookup.
  hint?: string | null;
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
  preferWiki = false,
  hint,
}: HeroPhotoProps) {
  const [open, setOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  // The single photo actually being shown: the stored one, or a name-matched
  // Wikipedia photo resolved below. Held here rather than inside PlaceImage so
  // the lightbox can open the SAME picture the hero is displaying.
  const [single, setSingle] = useState<string | null>(fallbackImageUrl ?? null);

  useEffect(() => {
    setSingle(fallbackImageUrl ?? null);
  }, [fallbackImageUrl]);

  useEffect(() => {
    // Only when the place has nothing of its own to show.
    if (images.length > 0 || fallbackImageUrl || !preferWiki) return;
    let alive = true;
    resolvePlaceImage(alt, hint ?? undefined)
      .then((url) => {
        if (alive && url) setSingle(url);
      })
      .catch(() => {
        // Leave the gradient tile in place.
      });
    return () => {
      alive = false;
    };
  }, [images.length, fallbackImageUrl, preferWiki, alt, hint]);

  const lightboxImages: LightboxImage[] =
    images.length > 0 ? images : single ? [{ url: single }] : [];
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
        ) : single ? (
          // A plain <img>, not next/image: admin-supplied photos are stored as
          // data URLs, which next/image refuses to load.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={single}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setSingle(null)}
          />
        ) : (
          <div className={`grid h-full w-full place-items-center bg-gradient-to-br ${gradient}`}>
            <span className="text-8xl drop-shadow sm:text-9xl">{emoji}</span>
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
