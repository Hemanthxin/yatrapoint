"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";

export interface MediaItem {
  url: string;
  kind: "image" | "video";
}

// Swipeable carousel for a post's media — falls back gracefully to a single
// image when there's only one item (the common case for older posts that
// predate multi-photo/video support).
export function MediaCarousel({
  media,
  alt,
  className = "",
  imgClassName = "h-full w-full object-cover",
}: {
  media: MediaItem[];
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  if (media.length === 0) return null;
  const current = media[Math.min(index, media.length - 1)];

  function go(delta: number) {
    setIndex((i) => Math.max(0, Math.min(media.length - 1, i + delta)));
  }

  return (
    <div className={`relative ${className}`}>
      {current.kind === "video" ? (
        <div className="relative h-full w-full">
          <video
            src={current.url}
            className={imgClassName}
            autoPlay
            loop
            muted={muted}
            playsInline
            controls={false}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMuted((m) => !m);
            }}
            aria-label={muted ? "Unmute" : "Mute"}
            className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current.url} alt={alt} className={imgClassName} />
      )}

      {media.length > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous"
              className="absolute left-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {index < media.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next"
              className="absolute right-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <div className="absolute top-3 right-3 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            {index + 1}/{media.length}
          </div>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {media.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition ${i === index ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
