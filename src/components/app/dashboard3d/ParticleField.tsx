"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface Particle {
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
}

// Small particles drifting slowly through the environment — pure CSS/Framer
// Motion ambient life. Count stays low and opacity restrained so it never
// competes with the data for attention.
export function ParticleField({ count = 26 }: { count?: number }) {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 2,
        duration: 14 + Math.random() * 16,
        delay: Math.random() * -20,
        drift: 20 + Math.random() * 40,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-cyan-200"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size }}
          animate={{
            y: [0, -p.drift, 0],
            x: [0, p.drift * 0.4, 0],
            opacity: [0, 0.5, 0],
          }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
