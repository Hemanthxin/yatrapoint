"use client";

import { motion } from "framer-motion";

type Tag = "span" | "h1" | "p" | "div";

interface AnimatedWordsProps {
  text: string;
  className?: string;
  as?: Tag;
  /** Seconds between each word's entrance — small, for a fast cascade. */
  stagger?: number;
  /** Extra delay before the first word starts. */
  delay?: number;
}

// Splits text into words and fires them in fast succession on mount — every
// word pops in on its own instead of the whole line fading as one block.
// Runs on plain mount (not scroll-gated whileInView), so it replays every
// time the surrounding page/component mounts fresh — e.g. every time the
// dashboard is opened, not just once per browser session.
export function AnimatedWords({
  text,
  className,
  as: As = "span",
  stagger = 0.05,
  delay = 0,
}: AnimatedWordsProps) {
  const words = text.split(" ");
  return (
    <As className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block will-change-transform"
          initial={{ opacity: 0, y: 16, scale: 0.9, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{
            duration: 0.35,
            delay: delay + i * stagger,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </As>
  );
}
