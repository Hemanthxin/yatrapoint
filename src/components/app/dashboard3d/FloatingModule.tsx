"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useSpatial } from "./SpatialStore";
import type { SpatialModule } from "./types";

// A floating frosted-glass panel — the "information module" the brief asks
// for in place of a flat card. Idle: drifts gently and sits at its own base
// position. Hover: nudges toward the camera and brightens. Selected: flies to
// the centre, in front of everything else, while every OTHER module eases
// back and dims — the "focused deep-dive" state.
export function FloatingModule({ mod }: { mod: SpatialModule }) {
  const { hoveredId, setHovered, selectedId, setSelected } = useSpatial();
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const panelMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const [localHover, setLocalHover] = useState(false);

  const isHovered = hoveredId === mod.id || localHover;
  const isSelected = selectedId === mod.id;
  const anotherSelected = selectedId !== null && !isSelected;

  const basePos = mod.position;
  const t0 = useRef(Math.random() * Math.PI * 2);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime + t0.current;

    let targetX = basePos[0];
    let targetY = basePos[1] + Math.sin(t * 0.6) * 0.08; // idle drift
    let targetZ = basePos[2];
    let targetScale = 1;
    let targetOpacity = 1;

    if (isSelected) {
      targetX = 0;
      targetY = 0.2;
      targetZ = 4.2;
      targetScale = 1.5;
      targetOpacity = 1;
    } else if (anotherSelected) {
      targetZ = basePos[2] - 2.2;
      targetScale = 0.82;
      targetOpacity = 0.25;
    } else if (isHovered) {
      targetZ = basePos[2] + 0.6;
      targetScale = 1.06;
    }

    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, targetX, 0.09);
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetY, 0.09);
    group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, targetZ, 0.09);
    const s = THREE.MathUtils.lerp(group.current.scale.x || 1, targetScale, 0.1);
    group.current.scale.setScalar(s);

    if (panelMat.current) {
      panelMat.current.opacity = THREE.MathUtils.lerp(panelMat.current.opacity, targetOpacity * 0.65, 0.1);
    }
    if (glow.current) {
      glow.current.intensity = THREE.MathUtils.lerp(glow.current.intensity, isHovered || isSelected ? 2.2 : 0.6, 0.1);
    }
  });

  const Icon = mod.icon;

  return (
    <group
      ref={group}
      position={basePos}
      onPointerOver={(e) => {
        e.stopPropagation();
        setLocalHover(true);
        setHovered(mod.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setLocalHover(false);
        setHovered(null);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        setSelected(isSelected ? null : mod.id);
      }}
    >
      <pointLight ref={glow} color={mod.color} intensity={0.6} distance={2.5} />
      <RoundedBox args={[1.5, 1.0, 0.08]} radius={0.12} smoothness={4}>
        <meshPhysicalMaterial
          ref={panelMat}
          color="#0b1220"
          transparent
          opacity={0.55}
          roughness={0.25}
          metalness={0.1}
          transmission={0.55}
          thickness={0.6}
          ior={1.25}
          clearcoat={0.6}
        />
      </RoundedBox>
      {/* Thin glowing edge so the panel reads as a defined object, not a haze. */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1.5, 1.0, 0.08)]} />
        <lineBasicMaterial color={mod.color} transparent opacity={isSelected || isHovered ? 0.9 : 0.4} />
      </lineSegments>

      <Html
        transform
        occlude={false}
        position={[0, 0, 0.05]}
        distanceFactor={6}
        className="pointer-events-none select-none"
      >
        <div className="flex w-[220px] flex-col items-start gap-1 p-3">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ backgroundColor: `${mod.color}22`, color: mod.color }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">{mod.label}</p>
          <p className="font-sans text-xl font-bold text-white">{mod.value}</p>
        </div>
      </Html>
    </group>
  );
}
