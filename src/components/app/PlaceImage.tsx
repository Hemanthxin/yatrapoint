"use client";

import { useEffect, useState } from "react";
import { fallbackImageUrl } from "@/lib/place-images";
import { resolvePlaceImage } from "@/lib/actions/place-image";

// Shows a real, NAME-MATCHED photo for a place:
//   1. a stored image if the place has one, else
//   2. its Wikipedia photo (resolved by name), else
//   3. a neutral seeded photo, else
//   4. a category-coloured gradient tile with an emoji.
// This keeps images relevant to each place instead of random category pictures.
export function PlaceImage({
  name,
  storedSrc,
  emoji,
  gradient,
  className = "",
  emojiClassName = "text-3xl",
}: {
  name: string;
  storedSrc?: string | null;
  emoji: string;
  gradient: string;
  className?: string;
  emojiClassName?: string;
}) {
  const [src, setSrc] = useState<string | null>(storedSrc || null);
  // 0 = wiki/stored, 1 = neutral fallback tried, 2 = give up (gradient)
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (storedSrc) return; // a real stored image always wins
    let alive = true;
    resolvePlaceImage(name)
      .then((url) => {
        if (alive) setSrc(url || fallbackImageUrl(name));
      })
      .catch(() => {
        if (alive) setSrc(fallbackImageUrl(name));
      });
    return () => {
      alive = false;
    };
  }, [name, storedSrc]);

  function onError() {
    if (stage === 0) {
      setStage(1);
      setSrc(fallbackImageUrl(name));
    } else {
      setStage(2);
    }
  }

  if (stage === 2 || !src) {
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
