"use client";

import { useState } from "react";

// Renders a place photo, trying the primary source then a fallback source, and
// finally a category-coloured gradient tile with an emoji — so a broken, blocked
// or errored image never looks empty or repeats a default placeholder.
export function PlaceImage({
  src,
  fallbackSrc,
  alt,
  emoji,
  gradient,
  className = "",
  emojiClassName = "text-3xl",
}: {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  emoji: string;
  gradient: string;
  className?: string;
  emojiClassName?: string;
}) {
  const sources = [src, fallbackSrc].filter(Boolean) as string[];
  const [step, setStep] = useState(0);
  const current = sources[step];

  if (!current) {
    return (
      <div className={`grid place-items-center bg-gradient-to-br ${gradient} ${emojiClassName} ${className}`}>
        {emoji}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={current}
      src={current}
      alt={alt}
      loading="lazy"
      onError={() => setStep((s) => s + 1)}
      className={`object-cover ${className}`}
    />
  );
}
