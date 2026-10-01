"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Torus, Sphere } from "@react-three/drei";
import * as THREE from "three";

export interface OrbitNode {
  id: string;
  label: string;
}

interface OrbitalHeroProps {
  /** The one big glanceable number — this user's trip count. */
  headline: number;
  headlineLabel: string;
  /** Revealed only on hover — real secondary stats, never invented ones. */
  subLines: string[];
  /** One orbiting node per upcoming trip (real data; empty is fine). */
  nodes: OrbitNode[];
}

const CYAN = "#67e8f9";
const BLUE = "#60a5fa";

// The dashboard's centrepiece: a layered ring sculpture with orbiting nodes
// (one per real upcoming trip) and the headline number as crisp HTML
// "holographic" typography at the centre — WebGL geometry for the sculpture,
// real DOM text for anything that has to stay legible while it moves in 3D.
export function OrbitalHero({ headline, headlineLabel, subLines, nodes }: OrbitalHeroProps) {
  const [hovered, setHovered] = useState(false);
  const outerRing = useRef<THREE.Mesh>(null);
  const innerRing = useRef<THREE.Mesh>(null);
  const sweepRing = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const scaleRef = useRef(1);

  const nodeAngles = useMemo(
    () => nodes.map((_, i) => (i / Math.max(1, nodes.length)) * Math.PI * 2),
    [nodes.length]
  );
  const nodeRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state, delta) => {
    if (outerRing.current) outerRing.current.rotation.z += delta * 0.06;
    if (innerRing.current) innerRing.current.rotation.z -= delta * 0.09;
    // The "progress" arc — a steady decorative sweep, not a fabricated
    // percentage (there's no honest "out of how many" to measure this user's
    // trip count against).
    if (sweepRing.current) sweepRing.current.rotation.z += delta * 0.35;

    const t = state.clock.elapsedTime;
    nodeRefs.current.forEach((n, i) => {
      if (!n) return;
      const angle = nodeAngles[i] + t * 0.25;
      const r = 2.1;
      n.position.set(Math.cos(angle) * r, Math.sin(angle) * r * 0.42, Math.sin(angle) * 0.6);
    });

    const target = hovered ? 1.12 : 1;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, target, 0.12);
    if (group.current) group.current.scale.setScalar(scaleRef.current);
  });

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Layered static rings — the "3D sculpture" body. */}
      <Torus ref={outerRing} args={[2.1, 0.015, 16, 120]} rotation={[Math.PI / 2.4, 0, 0]}>
        <meshStandardMaterial color={BLUE} emissive={BLUE} emissiveIntensity={hovered ? 1.4 : 0.8} transparent opacity={0.55} />
      </Torus>
      <Torus ref={innerRing} args={[1.6, 0.01, 16, 120]} rotation={[Math.PI / 2.2, 0, 0.3]}>
        <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={hovered ? 1.2 : 0.6} transparent opacity={0.4} />
      </Torus>
      {/* The animated "progress" arc — a partial ring, not a full one. */}
      <mesh ref={sweepRing} rotation={[Math.PI / 2.4, 0, 0]}>
        <ringGeometry args={[1.95, 2.0, 64, 1, 0, Math.PI * 0.55]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Orbiting data-point nodes — one per real upcoming trip. */}
      {nodes.map((n, i) => (
        <group key={n.id} ref={(el) => { nodeRefs.current[i] = el; }}>
          <Sphere args={[0.055, 16, 16]}>
            <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={1.6} />
          </Sphere>
          <Html center distanceFactor={9} occlude={false} className="pointer-events-none">
            <span className="whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-cyan-100 backdrop-blur-sm">
              {n.label}
            </span>
          </Html>
        </group>
      ))}

      {/* Holographic centre typography — real HTML, so it's always crisp and
          legible regardless of camera angle. */}
      <Html center distanceFactor={9} occlude={false} className="pointer-events-none select-none">
        <div className="flex flex-col items-center text-center">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            {headlineLabel}
          </p>
          <p
            className="font-sans text-6xl font-bold text-white"
            style={{ textShadow: "0 0 24px rgba(103,232,249,0.65), 0 0 60px rgba(96,165,250,0.35)" }}
          >
            {headline}
          </p>
          <div
            className={`mt-2 flex flex-col items-center gap-0.5 transition-all duration-500 ${
              hovered ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            {subLines.map((line) => (
              <p key={line} className="text-xs font-medium text-white/70">
                {line}
              </p>
            ))}
          </div>
        </div>
      </Html>
    </group>
  );
}
