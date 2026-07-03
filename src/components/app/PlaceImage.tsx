"use client";

import { useEffect, useState } from "react";
import { placeImageUrl, fallbackImageUrl } from "@/lib/place-images";
import { resolvePlaceImage } from "@/lib/actions/place-image";

// Shows a photo for a place, fast and reliably:
//   1. a stored image, else
//   2. a category-relevant photo (shown immediately — no server round-trip), else
//   3. a neutral photo, else
//   4. a category-coloured gradient tile with an emoji.
//
// Set `preferWiki` (detail heroes only) to additionally resolve a real,
// name-matched Wikipedia photo in the background and upgrade to it if found.
// We deliberately DON'T do that per card — a server action per list item made
// the whole app slow and frequently left cards blank.
export function PlaceImage({
  name,
  storedSrc,
  hint,
  category,
  emoji,
  gradient,
  className = "",
  emojiClassName = "text-3xl",
  preferWiki = false,
}: {
  name: string;
  storedSrc?: string | null;
  hint?: string;
  category?: string;
  emoji: string;
  gradient: string;
  className?: string;
  emojiClassName?: string;
  preferWiki?: boolean;
}) {
  // Start from a real photo immediately: stored image wins, otherwise a
  // deterministic category photo so something is always on screen.
  const [src, setSrc] = useState<string | null>(storedSrc || placeImageUrl(name, category));
  // 0 = primary photo, 1 = neutral fallback, 2 = gradient tile.
  const [stage, setStage] = useState(0);

  // Optional background upgrade to a name-matched Wikipedia photo (detail pages).
  useEffect(() => {
    if (storedSrc || !preferWiki) return;
    let alive = true;
    resolvePlaceImage(name, hint)
      .then((url) => {
        if (alive && url) {
          setSrc(url);
          setStage(0);
        }
      })
      .catch(() => {
        /* keep the deterministic photo */
      });
    return () => {
      alive = false;
    };
  }, [name, hint, storedSrc, preferWiki]);

  function onError() {
    if (stage === 0) {
      setStage(1);
      setSrc(fallbackImageUrl(name));
    } else {
      setStage(2);
      setSrc(null);
    }
  }

  if (!src) {
    return (
      <div className={`grid place-items-center bg-gradient-to-br ${gradient} ${emojiClassName} ${className}`}>
        {emoji}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={name}
      loading="lazy"
      onError={onError}
      className={`object-cover ${className}`}
    />
  );
}
