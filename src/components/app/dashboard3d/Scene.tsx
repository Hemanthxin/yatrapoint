"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useSpatial } from "./SpatialStore";

// The CSS equivalent of a camera rig: mouse parallax tilts the whole
// environment toward the pointer, dragging rotates it, and the wheel dollies
// between two depth layers — all real CSS 3D transforms on one group, inside
// a `perspective` container, no WebGL involved.
export function Scene({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { setLayer } = useSpatial();

  const rawRotX = useMotionValue(0);
  const rawRotY = useMotionValue(0);
  const rotX = useSpring(rawRotX, { stiffness: 60, damping: 20 });
  const rotY = useSpring(rawRotY, { stiffness: 60, damping: 20 });

  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartRotY = useRef(0);
  const baseRotY = useRef(0);

  const layerIndex = useRef(0);
  const sceneScale = useSpring(useMotionValue(1), { stiffness: 50, damping: 18 });
  const translateZ = useTransform(sceneScale, (s) => (s - 1) * 400);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;

    if (dragging.current) {
      const dx = e.clientX - dragStartX.current;
      // Clamped well short of 90° — past that the panels would be edge-on/
      // mirrored, and short of it a modest drag already reads as "the whole
      // environment turned to face you" without anything swinging off-frame.
      baseRotY.current = Math.max(-28, Math.min(28, dragStartRotY.current + dx * 0.05));
    }
    rawRotY.set(baseRotY.current + px * 6);
    rawRotX.set(-py * 5);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartRotY.current = baseRotY.current;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerUp() {
    dragging.current = false;
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    // Plain wheel scrolls the page (the journey story lives below the fold);
    // holding Shift keeps the old "dolly deeper" gesture.
    if (!e.shiftKey || Math.abs(e.deltaY) < 12) return;
    const next = Math.max(0, Math.min(1, layerIndex.current + (e.deltaY > 0 ? 1 : -1)));
    if (next === layerIndex.current) return;
    layerIndex.current = next;
    sceneScale.set(next === 0 ? 1 : 1.35);
    setLayer(next);
  }

  return (
    <div
      ref={ref}
      className="relative h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      style={{ perspective: 1400 }}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ rotateX: rotX, rotateY: rotY, scale: sceneScale, z: translateZ, transformStyle: "preserve-3d" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
