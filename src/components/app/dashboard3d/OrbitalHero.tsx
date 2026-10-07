"use client";

import { useRef, useState } from "react";
import { motion, useAnimationFrame } from "framer-motion";

export interface OrbitNode {
  id: string;
  label: string;
}

interface OrbitalHeroProps {
  /** The one big glanceable number — this user's trip count. */
  headline: number;
  headlineLabel: string;
  /** Revealed only on hover — real secondary stats, never invented ones. */
  subLines: string[];
  /** One orbiting node per upcoming trip (real data; empty is fine). */
  nodes: OrbitNode[];
  /** True while a module is focused dead-centre — the hero sits at the same
   *  spot, so it fades back rather than fighting the module for attention. */
  dimmed?: boolean;
}

// The dashboard's centrepiece, built from real CSS 3D transforms (no WebGL):
// layered tilted rings that spin continuously, a partial "progress" arc, and
// orbiting nodes — one per real upcoming trip — tracing a circular path
// computed every frame. The headline number sits at the centre as crisp,
// always-legible typography.
export function OrbitalHero({ headline, headlineLabel, subLines, nodes, dimmed = false }: OrbitalHeroProps) {
  const [hovered, setHovered] = useState(false);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const t = useRef(0);

  useAnimationFrame((_, delta) => {
    t.current += delta / 1000;
    nodes.forEach((_, i) => {
      const el = nodeRefs.current[i];
      if (!el) return;
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2 + t.current * 0.35;
      const rx = 150; // px
      const ry = 60; // squashed to read as an ellipse in perspective
      el.style.transform = `translate3d(${Math.cos(angle) * rx}px, ${Math.sin(angle) * ry}px, ${Math.sin(angle) * 40}px)`;
    });
  });

  return (
    <motion.div
      className="relative flex h-[22rem] w-[22rem] items-center justify-center"
      style={{ perspective: 900 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={{ scale: hovered ? 1.06 : 1, opacity: dimmed ? 0.15 : 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Layered tilted rings — the "3D sculpture" body. Each is a flat CSS
          circle rotated in 3D space (rotateX) so it reads as a disc viewed at
          an angle, then spun continuously around its own axis. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute h-72 w-72 rounded-full border border-emerald-600/40"
        style={{ rotateX: 70, boxShadow: "0 0 40px rgba(5,150,105,0.25)" }}
        animate={{ rotateZ: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute h-56 w-56 rounded-full border border-green-700/30"
        style={{ rotateX: 68, rotateZ: 30 }}
        animate={{ rotateZ: [30, -330] }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
      />
      {/* The animated "progress" arc — a partial ring, not a fabricated
          percentage (there's no honest "out of how many" to measure a trip
          count against), just a steady decorative sweep. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute h-72 w-72"
        style={{ transform: "rotateX(70deg)" }}
        viewBox="0 0 100 100"
      >
        <motion.circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="#059669"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="90 212"
          animate={{ rotate: 360 }}
          transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%" }}
        />
      </svg>

      {/* Orbiting data-point nodes — one per real upcoming trip. */}
      {nodes.map((n, i) => (
        <div
          key={n.id}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          className="pointer-events-none absolute"
          style={{ transformStyle: "preserve-3d" }}
        >
          <span
            className="block h-2.5 w-2.5 rounded-full bg-emerald-600"
            style={{ boxShadow: "0 0 10px 3px rgba(5,150,105,0.5)" }}
          />
          <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 shadow-sm backdrop-blur-sm">
            {n.label}
          </span>
        </div>
      ))}

      {/* Centre typography — a soft white halo (not a dark glow) keeps dark
          text readable against the busy, bright background photo. */}
      <div className="pointer-events-none relative z-10 flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-700/80">{headlineLabel}</p>
        <p
          className="font-sans text-6xl font-bold text-slate-900"
          style={{ textShadow: "0 0 20px var(--sb-glow, rgba(255,255,255,0.9)), 0 0 48px var(--sb-glow, rgba(255,255,255,0.6))" }}
        >
          {headline}
        </p>
        <div
          className={`mt-2 flex flex-col items-center gap-0.5 overflow-hidden transition-all duration-500 ${
            hovered ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {subLines.map((line) => (
            <p key={line} className="text-xs font-medium text-slate-700" style={{ textShadow: "0 0 12px var(--sb-glow, rgba(255,255,255,0.9))" }}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
