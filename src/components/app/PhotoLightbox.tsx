"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxImage {
  url: string;
  caption?: string | null;
}

interface PhotoLightboxProps {
  images: LightboxImage[];
  alt: string;
  open: boolean;
  // Which image to show when it opens.
  startIndex?: number;
  onClose: () => void;
}

// Full-screen photo viewer. Opened by tapping a place's hero image, which
// previously did nothing at all — the photo was only ever visible at hero size,
// cropped to a wide strip and with the title laid over the bottom of it, so
// there was no way to actually look at the picture.
//
// Rendered through a portal to document.body: `fixed inset-0` positions against
// the viewport, and any ancestor with a `transform` (the page's entrance
// animations use one) would otherwise become the containing block and clip it.
export function PhotoLightbox({
  images,
  alt,
  open,
  startIndex = 0,
  onClose,
}: PhotoLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(startIndex);

  useEffect(() => setMounted(true), []);

  // Re-open on whichever image was clicked.
  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  const count = images.length;
  const go = useCallback(
    (delta: number) => setIndex((i) => (count === 0 ? 0 : (i + delta + count) % count)),
    [count]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling under the viewer.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, go]);

  if (!open || !mounted || count === 0) return null;

  const current = images[Math.min(index, count - 1)];

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      // Clicking the backdrop closes; clicks on the photo itself don't.
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 p-4">
        <p className="min-w-0 truncate text-sm font-semibold text-white/90">
          {alt}
          {count > 1 && (
            <span className="ml-2 font-medium text-white/50">
              {index + 1} / {count}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {/* object-contain, not cover: the point of opening this is to see the
            WHOLE photo rather than the cropped strip the hero shows. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full cursor-default select-none object-contain"
        />

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 active:scale-95"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 active:scale-95"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {current.caption && (
        <p
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 px-6 pb-6 text-center text-sm text-white/80"
        >
          {current.caption}
        </p>
      )}

      {count > 1 && (
        <div className="no-scrollbar flex shrink-0 justify-center gap-2 overflow-x-auto px-4 pb-5">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Photo ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                i === index ? "ring-white" : "ring-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
