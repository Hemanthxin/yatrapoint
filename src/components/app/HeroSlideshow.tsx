"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

interface HeroSlideshowProps {
  images: string[];
  alt: string;
  intervalMs?: number;
  className?: string;
  // Lets the parent keep its own dot indicators / controls in sync.
  onIndexChange?: (index: number) => void;
}

// Auto-advancing hero backdrop — each slide crossfades in from an alternating
// side while it's slowly "Ken Burns" panning/zooming, so consecutive slides
// never feel like a repeat of the same plain fade. Admin-uploaded banners
// (data: URLs) render as a plain <img>; the shipped defaults use next/image.
export function HeroSlideshow({
  images,
  alt,
  intervalMs = 6000,
  className = "",
  onIndexChange,
}: HeroSlideshowProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  useEffect(() => {
    onIndexChange?.(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <AnimatePresence initial={false}>
        {images.map((src, i) => {
          if (i !== index) return null;
          const fromRight = i % 2 === 0;
          const isDataUrl = src.startsWith("data:");
          return (
            <motion.div
              key={`${src}-${i}`}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.1, x: fromRight ? 28 : -28 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 1.04, x: fromRight ? -28 : 28 }}
              transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Slow continuous pan/zoom for the duration this slide is shown. */}
              <motion.div
                className="absolute inset-[-6%]"
                animate={{ scale: [1, 1.09], x: fromRight ? [0, -22] : [0, 22] }}
                transition={{ duration: intervalMs / 1000 + 1.3, ease: "linear" }}
              >
                {isDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={alt} className="h-full w-full object-cover" />
                ) : (
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    priority={i === 0}
                    sizes="(max-width: 1280px) 100vw, 60vw"
                    className="object-cover"
                  />
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
