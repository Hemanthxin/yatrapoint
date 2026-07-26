"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

interface RevealGridProps {
  className?: string;
  children: React.ReactNode;
}

// Wraps a card grid and injects a `direction`/`delay` prop into each direct
// child, so left-hand columns slide in from the left and right-hand columns
// from the right — cards converge toward the center instead of every card
// doing the same generic fade-up. Column count is read from the live
// computed `grid-template-columns` rather than hardcoded, so the left/right
// split stays correct across every `sm:`/`lg:`/`2xl:` breakpoint in the app.
//
// Non-grid containers (a single-column list, a `space-y-*` stack) report one
// column; in that case we fall back to alternating every other item so a
// single-column feed still gets a left/right zigzag instead of everything
// arriving from the same side.
//
// A child that already sets its own `direction` or `delay` (e.g. festival
// cards with a hand-tuned stagger) keeps it — this only fills in what isn't
// already specified.
export function RevealGrid({ className, children }: RevealGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const template = getComputedStyle(el).gridTemplateColumns;
      const count = template.split(" ").filter(Boolean).length;
      setColumns(Math.max(1, count));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effectiveColumns = columns > 1 ? columns : 2;
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{
    direction?: "up" | "left" | "right";
    delay?: number;
  }>[];

  return (
    <div ref={ref} className={className}>
      {items.map((child, i) => {
        const col = i % effectiveColumns;
        const row = Math.floor(i / effectiveColumns);
        const direction = child.props.direction ?? (col < effectiveColumns / 2 ? "left" : "right");
        const delay = child.props.delay ?? Math.min(row, 6) * 0.07;
        return cloneElement(child, { key: child.key ?? i, direction, delay });
      })}
    </div>
  );
}
