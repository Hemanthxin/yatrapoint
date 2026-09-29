"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export interface OrbitStat {
  icon: LucideIcon;
  value: string;
  label: string;
  href: string;
}

interface Brand3DHeroProps {
  stats: OrbitStat[];
  className?: string;
}

const CHIP_POSITION = [
  "-left-8 -top-2",
  "-right-6 top-6",
  "-left-10 bottom-8",
  "-right-8 -bottom-2",
];

// The dashboard's centerpiece: the Saafera mark floating as a "3D coin" that
// spins/recedes as the page scrolls past the hero, with quick-stat chips
// orbiting it instead of sitting in a flat grid. Scroll-linked transforms are
// driven by this section's own scroll progress (not the whole page's), so the
// effect plays out exactly across the hero's height. `useReducedMotion` zeroes
// the scroll-driven rotation/parallax for anyone who's asked for less motion —
// only the one-time fade-in mount animation still plays.
export function Brand3DHero({ stats, className = "" }: Brand3DHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  // Capped well under 90° — a flat single-faced image would show a mirrored
  // backface past that point, so this stays a confident tilt, not a spin.
  const rotateY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 55]);
  const coinScale = useTransform(scrollYProgress, [0, 1], reduceMotion ? [1, 1] : [1, 0.7]);
  const liftY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, -64]);
  const chipsOpacity = useTransform(scrollYProgress, [0, 0.55, 1], [1, 0.5, 0]);
  const orbAY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -36]);
  const orbBY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 46]);

  return (
    <div ref={ref} className={`relative ${className}`} style={{ perspective: 1400 }}>
      <motion.span
        aria-hidden
        style={{ y: orbAY }}
        className="pointer-events-none absolute -left-8 -top-10 h-40 w-40 rounded-full bg-emerald-400/30 blur-3xl"
      />
      <motion.span
        aria-hidden
        style={{ y: orbBY }}
        className="pointer-events-none absolute -right-4 bottom-0 h-48 w-48 rounded-full bg-teal-300/20 blur-3xl"
      />

      <div className="relative mx-auto flex h-full w-full max-w-[16rem] items-center justify-center">
        {/* Scroll-driven layer: rotation, recede-scale, parallax lift. */}
        <motion.div style={{ rotateY, scale: coinScale, y: liftY }} className="relative">
          {/* Mount layer: one-time 3D flip-in, independent of scroll. */}
          <motion.div
            initial={{ opacity: 0, rotateX: -65, scale: 0.75 }}
            animate={{ opacity: 1, rotateX: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformStyle: "preserve-3d" }}
            className="relative"
          >
            <div
              aria-hidden
              className="absolute -inset-3 rounded-[2.25rem] bg-gradient-to-br from-emerald-400 via-teal-300 to-emerald-600 opacity-70 blur-md"
            />
            <div className="relative h-48 w-48 overflow-hidden rounded-[2rem] bg-white p-3 shadow-2xl shadow-emerald-950/40 ring-1 ring-white/40 sm:h-56 sm:w-56">
              <Image
                src="/saafera-logo.jpg"
                alt="Saafera"
                fill
                sizes="224px"
                className="object-contain p-2"
                priority
              />
              <div aria-hidden className="sheen-overlay animate-sheen" />
            </div>
          </motion.div>
        </motion.div>

        {/* Orbiting quick-stat chips. */}
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              style={{ opacity: chipsOpacity }}
              className={`absolute hidden sm:block ${CHIP_POSITION[i % CHIP_POSITION.length]}`}
            >
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.55, delay: 0.55 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={s.href}
                  className="flex items-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-3 py-2 text-white shadow-lg backdrop-blur-md transition hover:bg-white/25"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/20">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-sm font-bold">{s.value}</span>
                    <span className="block truncate text-[10px] font-medium text-white/80">{s.label}</span>
                  </span>
                </Link>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
