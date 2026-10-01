"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";

interface ParallaxCtx {
  x: MotionValue<number>;
  y: MotionValue<number>;
}
const Ctx = createContext<ParallaxCtx | null>(null);

// Tracks the pointer across the whole stage and exposes smoothed -0.5..0.5
// motion values any descendant can read. A plain React context rather than
// prop-drilling, since the stage (BackgroundScene + Hero) and the layers that
// react to it (glow orbs, the logo) live in sibling files. Anything NOT
// wrapped in <ParallaxLayer> (the sign-in card, in particular) is rendered
// inside the stage purely so the pointer area covers the whole hero —
// it never reads the context, so it never moves.
export function ParallaxStage({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 40, damping: 18, mass: 0.4 });
  const y = useSpring(rawY, { stiffness: 40, damping: 18, mass: 0.4 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    rawX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <div ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave} className={className}>
      <Ctx.Provider value={{ x, y }}>{children}</Ctx.Provider>
    </div>
  );
}

function useParallaxXY() {
  const ctx = useContext(Ctx);
  // Outside a <ParallaxStage> (e.g. storybook/isolated use), fall back to a
  // static zero so nothing crashes — it just doesn't move.
  const zeroX = useMotionValue(0);
  const zeroY = useMotionValue(0);
  return ctx ?? { x: zeroX, y: zeroY };
}

// Translates by `depth` px at the pointer's extreme — negative depth drifts
// opposite the pointer (reads as "further away"), positive drifts with it
// ("closer"). Pass `rotate` for a 3D tilt instead of/alongside a translate.
export function ParallaxLayer({
  depth = 20,
  rotate,
  className,
  style,
  children,
}: {
  depth?: number;
  rotate?: number;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const { x, y } = useParallaxXY();
  const tx = useTransform(x, (v) => v * depth);
  const ty = useTransform(y, (v) => v * depth);
  const rx = useTransform(y, (v) => (rotate ? v * -rotate : 0));
  const ry = useTransform(x, (v) => (rotate ? v * rotate : 0));

  return (
    <motion.div
      style={{ x: tx, y: ty, rotateX: rx, rotateY: ry, ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
