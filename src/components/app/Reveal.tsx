"use client";

import { motion } from "framer-motion";
import type { FormEventHandler, ReactNode } from "react";

type Tag = "div" | "li" | "article" | "section" | "span" | "header" | "main" | "aside" | "form" | "ul";

const MOTION_TAGS = {
  div: motion.div,
  li: motion.li,
  article: motion.article,
  section: motion.section,
  span: motion.span,
  header: motion.header,
  main: motion.main,
  aside: motion.aside,
  form: motion.form,
  ul: motion.ul,
} as const;

type Direction = "up" | "left" | "right";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Extra delay in seconds — pass `index * 0.06` for staggered lists/grids. */
  delay?: number;
  /** Distance (px) the content travels while fading in (direction="up"). */
  y?: number;
  /** Distance (px) the content travels while fading in (direction="left"/"right"). */
  x?: number;
  /** Which side the content enters from. "left"/"right" use a longer travel
   *  distance and a light scale-in so the motion reads clearly. */
  direction?: Direction;
  /** Render as a different element (e.g. "li", "article", "section"). */
  as?: Tag;
  /** Fraction of the element that must be visible before it reveals (0–1). */
  amount?: number;
  /** Forwarded straight to the underlying element — e.g. onSubmit for `as="form"`. */
  onSubmit?: FormEventHandler;
  id?: string;
}

const DEFAULT_X = 72;

// Scroll-triggered reveal — the framer-motion replacement for the old
// mount-only `.animate-fadeUp` CSS class. Animates once, the first time the
// element scrolls into view, instead of firing for everything at page load
// (which never showed any motion for content below the fold).
//
// direction="up" (default) is the original vertical fade — used for headers,
// forms, single-column content. direction="left"/"right" is for grid cards:
// a longer horizontal travel plus a subtle scale-in gives it real, visible
// weight instead of the barely-there vertical nudge.
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  x,
  direction = "up",
  as = "div",
  amount = 0.2,
  onSubmit,
  id,
}: RevealProps) {
  const MotionTag = MOTION_TAGS[as];
  const travel = x ?? DEFAULT_X;
  const initial =
    direction === "left"
      ? { opacity: 0, x: -travel, y: 0, scale: 0.96 }
      : direction === "right"
        ? { opacity: 0, x: travel, y: 0, scale: 0.96 }
        : { opacity: 0, x: 0, y, scale: 1 };

  return (
    <MotionTag
      className={className}
      id={id}
      onSubmit={onSubmit}
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount }}
      transition={{
        duration: direction === "up" ? 0.5 : 0.65,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </MotionTag>
  );
}

// Wraps a list/grid of children, staggering each direct child's reveal.
// Use for card grids where you don't want to hand-compute a delay per item.
export function RevealGroup({
  children,
  className,
  stagger = 0.07,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      transition={{ staggerChildren: stagger }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className, y = 24 }: { children: ReactNode; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}
    >
      {children}
    </motion.div>
  );
}
