"use client";

import { Sparkles } from "@react-three/drei";

// Small particles drifting slowly through the environment — ambient life,
// never competing with the data for attention (low count, low opacity, slow).
export function ParticleField() {
  return (
    <>
      <Sparkles count={60} scale={[9, 5, 4]} size={1.6} speed={0.25} opacity={0.35} color="#7dd3fc" position={[0, 0.5, -1]} />
      <Sparkles count={30} scale={[14, 7, 6]} size={1} speed={0.15} opacity={0.18} color="#60a5fa" position={[0, 0, -3]} />
    </>
  );
}
