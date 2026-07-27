"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// A small pill that gently pulses forever — used for "Up next" style badges.
// Framer Motion's `motion.*` components can only be touched from a Client
// Component, so this is kept as its own tiny leaf rather than used inline
// inside a Server Component page.
export function PulseBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.span
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      className={className}
    >
      {children}
    </motion.span>
  );
}
