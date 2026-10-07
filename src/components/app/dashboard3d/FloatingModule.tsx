"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useSpatial } from "./SpatialStore";
import type { SpatialModule } from "./types";

// A floating frosted-glass panel — the "information module" in place of a
// flat card. Built from real CSS 3D transforms (translateZ via the `z` motion
// value) inside the scene's `perspective` container, not WebGL. Idle: sits at
// its own depth, drifting gently. Hover: lifts toward the camera and
// brightens. Selected: flies to centre stage, in front of everything, while
// every OTHER module eases back and dims — the "focused deep-dive" state.
export function FloatingModule({ mod }: { mod: SpatialModule }) {
  const { hoveredId, setHovered, selectedId, setSelected } = useSpatial();
  const [localHover, setLocalHover] = useState(false);

  const isHovered = hoveredId === mod.id || localHover;
  const isSelected = selectedId === mod.id;
  const anotherSelected = selectedId !== null && !isSelected;

  const [xPct, yPct, depth] = mod.position;
  const baseScale = 1 + depth * 0.08;

  const state = isSelected ? "selected" : anotherSelected ? "dimmed" : isHovered ? "hovered" : "idle";

  const variants = {
    idle: { top: `${yPct}%`, left: `${xPct}%`, x: "-50%", y: "-50%", z: depth * 50, scale: baseScale, opacity: 1 },
    hovered: {
      top: `${yPct}%`,
      left: `${xPct}%`,
      x: "-50%",
      y: "-50%",
      z: depth * 50 + 40,
      scale: baseScale * 1.08,
      opacity: 1,
    },
    dimmed: {
      top: `${yPct}%`,
      left: `${xPct}%`,
      x: "-50%",
      y: "-50%",
      z: depth * 50 - 60,
      scale: baseScale * 0.82,
      opacity: 0.25,
    },
    selected: { top: "50%", left: "50%", x: "-50%", y: "-50%", z: 160, scale: 1.4, opacity: 1 },
  } as const;

  const Icon = mod.icon;
  const glowing = isHovered || isSelected;

  return (
    <motion.div
      className="absolute w-[13rem] cursor-pointer select-none"
      style={{ zIndex: isSelected ? 50 : isHovered ? 20 : 10 }}
      animate={state}
      variants={variants}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => {
        setLocalHover(true);
        setHovered(mod.id);
      }}
      onHoverEnd={() => {
        setLocalHover(false);
        setHovered(null);
      }}
      onClick={() => setSelected(isSelected ? null : mod.id)}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: isSelected ? 0 : Infinity, ease: "easeInOut" }}
        className="rounded-2xl p-4 backdrop-blur-xl transition-colors duration-300"
        style={{
          background: "color-mix(in srgb, var(--surface) 86%, transparent)",
          // Neumorphic light/dark pair instead of a border — sitting over a
          // photo (not a flat colour) so it can't vanish into the
          // background the way a true neumorphic card does, but the same
          // "extruded" shadow logic still applies.
          boxShadow: glowing
            ? `0 0 0 2px ${mod.color}aa, 0 0 26px -2px ${mod.color}66`
            : `0 0 0 1.5px rgb(var(--ink) / 0.35), 0 14px 22px -12px rgb(var(--shadow) / 0.6)`,
        }}
      >
        <span
          className="grid h-9 w-9 place-items-center rounded-lg"
          style={{ backgroundColor: `${mod.color}1f`, color: mod.color }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{mod.label}</p>
        <p className="font-sans text-xl font-bold text-slate-900">{mod.value}</p>
      </motion.div>
    </motion.div>
  );
}
