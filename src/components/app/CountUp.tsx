"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

interface CountUpProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

// Animates from 0 up to `value` on mount — dashboard stat numbers tick into
// place instead of just appearing. `format` runs on every intermediate
// frame, so pass the same formatter used for the final value (padStart,
// formatINR, etc.) and every frame in between stays correctly formatted.
export function CountUp({ value, duration = 1.2, format, className }: CountUpProps) {
  const fmt = format ?? ((n: number) => Math.round(n).toString());
  const [display, setDisplay] = useState(() => fmt(0));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(fmt(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
