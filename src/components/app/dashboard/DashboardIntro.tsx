"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

const SEEN_KEY = "saafera-dashboard-intro-seen";
const SPARK_COUNT = 14;

type Phase = "logo" | "explode" | "done";

interface Spark {
  x: number;
  y: number;
  z: number;
  rotate: number;
}

// A one-time splash that plays the first time the dashboard opens in a
// browser session: the Saafera mark tumbles in 3D and detonates — a tilted
// shockwave disc expands, sparks scatter across a full sphere (not a flat
// ring), the mark itself rotates on X/Y while rocketing toward the camera on
// Z — then the whole overlay dissolves to reveal the real dashboard, which is
// rendering independently underneath the whole time. Purely additive: the
// dashboard is never hidden or scaled to make this work (`pointer-events-none`
// the entire time too), so a slow or failed script just means the flourish
// never plays — the real page is always fully there and usable underneath it.
export function DashboardIntro() {
  const [phase, setPhase] = useState<Phase>("logo");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen) {
      setPhase("done");
      return;
    }
    const toExplode = setTimeout(() => setPhase("explode"), 550);
    const toDone = setTimeout(() => {
      setPhase("done");
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {}
    }, 1250);
    return () => {
      clearTimeout(toExplode);
      clearTimeout(toDone);
    };
  }, []);

  // Scattered once, the instant detonation starts — a full sphere of
  // directions (not a flat 2D ring), so the burst reads as genuinely 3D.
  const sparks = useMemo<Spark[]>(() => {
    if (phase !== "explode") return [];
    return Array.from({ length: SPARK_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 160 + Math.random() * 140;
      return {
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        rotate: Math.random() * 360,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "explode"]);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[200] grid place-items-center bg-[color:var(--app-bg)]"
          style={{ perspective: 1400 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Tilted 3D shockwave disc — rotated on X so it reads as a ring
              expanding away across the ground plane, not a flat 2D pulse. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute h-32 w-32 rounded-full border-2 border-emerald-400/70"
            style={{ rotateX: 72, transformStyle: "preserve-3d" }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={
              phase === "explode" ? { scale: 14, opacity: [0, 0.7, 0] } : { scale: 1, opacity: 0 }
            }
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Glow burst */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 via-teal-300 to-emerald-500 blur-xl"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={
              phase === "explode" ? { scale: 9, opacity: [0, 0.8, 0] } : { scale: 1, opacity: 0.4 }
            }
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Sparks scattered across a full sphere of directions. */}
          {sparks.map((s, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]"
              style={{ transformStyle: "preserve-3d" }}
              initial={{ x: 0, y: 0, z: 0, opacity: 1, scale: 1 }}
              animate={{ x: s.x, y: s.y, z: s.z, opacity: 0, scale: 0.3, rotate: s.rotate }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}

          {/* The mark itself: tumbles on X/Y while rocketing toward the
              camera on Z, then fades — a genuine 3D detonation rather than a
              flat scale-and-fade. */}
          <motion.div
            className="logo-plate relative h-24 w-24 overflow-hidden rounded-[1.5rem] p-2.5 shadow-2xl shadow-emerald-950/40 ring-1 ring-white/40"
            style={{ transformStyle: "preserve-3d" }}
            initial={{ scale: 0.5, opacity: 0, rotateX: -20, rotateY: -30, z: -80 }}
            animate={
              phase === "explode"
                ? { scale: 3.4, opacity: 0, rotateX: 35, rotateY: 130, z: 260 }
                : { scale: 1, opacity: 1, rotateX: 0, rotateY: 0, z: 0 }
            }
            transition={{ duration: phase === "explode" ? 0.65 : 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/saafera-logo.jpg"
              alt="Saafera"
              fill
              sizes="96px"
              className="object-contain p-1.5"
              priority
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
