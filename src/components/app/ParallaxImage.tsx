"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

interface ParallaxImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

// Hero banner image with a subtle scroll-linked parallax — it travels a
// little slower than the page as you scroll past it, giving the banner
// depth instead of sitting flat like a plain <Image fill>. The wrapper is
// oversized (-10% on every side) so the shifted image never reveals an edge;
// the parent section's own overflow-hidden clips it back to shape.
export function ParallaxImage({ src, alt, className, sizes, priority }: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "12%"]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-[-10%]">
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={className} />
      </motion.div>
    </div>
  );
}
