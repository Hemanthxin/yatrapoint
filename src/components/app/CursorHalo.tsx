"use client";

import { useEffect, useRef } from "react";

// A restrained cursor companion: a thin ring that trails the pointer and swells
// over anything interactive. Ported from the Rexovi design system
// (d:\Hemanth\pro, components/site/CursorHalo.tsx).
//
// Three things keep it cheap and unobtrusive:
//   • transform-only, driven by one rAF loop — it never touches layout, so it
//     cannot cause reflow however fast the pointer moves.
//   • the ring LERPs toward the pointer (0.16) instead of snapping to it, which
//     is what makes it read as a companion rather than a second cursor.
//   • it never mounts its listeners on a touch device or for anyone who asked
//     for reduced motion; on those it is inert and CSS hides it too.
export function CursorHalo() {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ring.current;
    if (!fine || calm || !el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let raf = 0;
    let visible = false;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        visible = true;
        el.dataset.on = "true";
      }
      const target = e.target as Element | null;
      // Anything the traveller can act on makes the ring swell.
      const hot = target?.closest(
        "a, button, [role='button'], [data-cursor='hot'], input, textarea, select, summary"
      );
      el.dataset.hot = hot ? "true" : "false";
    };

    const onLeave = () => {
      visible = false;
      el.dataset.on = "false";
    };

    const tick = () => {
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ring} className="cursor-halo" data-on="false" data-hot="false" aria-hidden />;
}
