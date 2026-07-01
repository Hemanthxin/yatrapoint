"use client";

import { useState } from "react";

// Renders a place photo; on load error it falls back to a category-coloured
// gradient tile with an emoji, so a broken/blocked image never looks empty.
export function PlaceImage({
  src,
  alt,
  emoji,
  gradient,
  className = "",
  emojiClassName = "text-3xl",
}: {
  src?: string | null;
  alt: string;
  emoji: string;
  gradient: string;
  className?: string;
  emojiClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`grid place-items-center bg-gradient-to-br ${gradient} ${emojiClassName} ${className}`}>
        {emoji}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
