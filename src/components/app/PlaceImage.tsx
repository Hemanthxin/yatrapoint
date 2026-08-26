"use client";

import { useEffect, useState } from "react";
import { fallbackImageUrl } from "@/lib/place-images";
import { resolvePlaceImage } from "@/lib/actions/place-image";

// Shows a photo for a place, fast and reliably:
//   1. a stored image, else
//   2. a category-coloured gradient tile with an emoji (INSTANT — no network).
//
// Cards deliberately do NOT hit an external image service: with hundreds of
// cards on screen, one request each to loremflickr/picsum made the whole app
// crawl. So a card with no stored image shows a clean gradient tile immediately.
// Detail heroes pass `preferWiki` to resolve a real, name-matched Wikipedia
// photo in the background and upgrade to it if found.
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
  // A stored image wins; otherwise show the gradient tile instantly (null src)
  // rather than fetching a slow external photo per card.
  const [src, setSrc] = useState<string | null>(storedSrc || null);
  // 0 = primary photo, 1 = neutral fallback, 2 = gradient tile.
  const [stage, setStage] = useState(0);

  // Adopt the new place when the props change.
  //
  // `src` is seeded from `storedSrc` ONCE, at mount. Whenever React reuses this
  // component instance for a DIFFERENT place — paging a catalogue grid is the
  // case that bites, since the grid renders the same number of cards in the
  // same positions — the initialiser does not run again, so the name and the
  // description updated while the photo stayed on the previous page's place.
  // It looked like a caching problem and cleared on refresh, because a refresh
  // remounts everything.
  useEffect(() => {
    setSrc(storedSrc || null);
    setStage(0);
  }, [storedSrc, name]);

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
