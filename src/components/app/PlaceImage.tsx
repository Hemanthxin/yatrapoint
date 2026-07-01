"use client";

import { useEffect, useState } from "react";
import { placeImageUrl, fallbackImageUrl } from "@/lib/place-images";
import { resolvePlaceImage } from "@/lib/actions/place-image";

// Shows a NAME-MATCHED photo for a place:
//   1. a stored image, else
//   2. its Wikipedia photo (resolved by name + location hint), else
//   3. a category-relevant photo (e.g. a temple for a pilgrimage), else
//   4. a neutral photo, else
//   5. a category-coloured gradient tile with an emoji.
export function PlaceImage({
  name,
  storedSrc,
  hint,
  category,
  emoji,
  gradient,
  className = "",
  emojiClassName = "text-3xl",
}: {
  name: string;
  storedSrc?: string | null;
  hint?: string;
  category?: string;
  emoji: string;
  gradient: string;
  className?: string;
  emojiClassName?: string;
}) {
  const [src, setSrc] = useState<string | null>(storedSrc || null);
  const [fellBack, setFellBack] = useState(false);

  useEffect(() => {
    if (storedSrc) return; // a real stored image always wins
    let alive = true;
    resolvePlaceImage(name, hint)
      .then((url) => {
        if (alive) setSrc(url || placeImageUrl(name, category));
      })
      .catch(() => {
        if (alive) setSrc(placeImageUrl(name, category));
      });
    return () => {
      alive = false;
    };
  }, [name, hint, category, storedSrc]);

  function onError() {
    // Wiki/category image failed to load → neutral photo, then gradient.
    if (!fellBack) {
      setFellBack(true);
      setSrc(fallbackImageUrl(name));
    } else {
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
