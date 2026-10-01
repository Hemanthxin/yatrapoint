"use client";

import { useRef, type ReactNode } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useSpatial } from "./SpatialStore";

// Three interaction behaviours the brief asks for, all living in one rig
// instead of three separate pointer-listener components fighting each other:
//   • mouse parallax — the camera drifts a little toward the pointer
//   • drag-to-rotate — dragging spins the whole data environment (the group
//     this wraps), not the camera, so the hero stays centred
//   • scroll-to-dolly — the wheel moves the camera between the "overview"
//     and "deep" spatial layers instead of scrolling a page (the dashboard's
//     <main> has no scrollbar at all in spatial mode)
export function CameraRig({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const { setLayer } = useSpatial();

  const pointer = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, rotY: 0 });
  const targetRotY = useRef(0);
  const currentRotY = useRef(0);
  const targetZ = useRef(11);
  const currentZ = useRef(11);
  const layerRef = useRef(0);

  useFrame(() => {
    // Parallax: camera x/y drift gently toward the pointer, never far enough
    // to lose the scene off-frame.
    const targetX = pointer.current.x * 0.9;
    const targetY = pointer.current.y * 0.5 + 1.2;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.04);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, currentZ.current, 0.06);
    camera.lookAt(0, 0.4, 0);

    currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ.current, 0.08);

    if (group.current) {
      currentRotY.current = THREE.MathUtils.lerp(currentRotY.current, targetRotY.current, 0.08);
      group.current.rotation.y = currentRotY.current;
    }
  });

  function onPointerMove(e: ThreeEvent<PointerEvent>) {
    const el = gl.domElement;
    const rect = el.getBoundingClientRect();
    pointer.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.current.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    if (dragging.current) {
      const dx = e.clientX - dragStart.current.x;
      // A generous divisor — rotating the whole environment should feel
      // deliberate, not twitchy.
      targetRotY.current = dragStart.current.rotY + dx * 0.006;
    }
  }

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    dragging.current = true;
    dragStart.current = { x: e.clientX, rotY: targetRotY.current };
    gl.domElement.setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: ThreeEvent<PointerEvent>) {
    dragging.current = false;
    try {
      gl.domElement.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  function onWheel(e: ThreeEvent<WheelEvent>) {
    // One discrete step per "intentional" scroll gesture, not a continuous
    // dolly — a data dashboard with free-scrolling zoom feels out of control.
    if (Math.abs(e.deltaY) < 12) return;
    const next = THREE.MathUtils.clamp(layerRef.current + (e.deltaY > 0 ? 1 : -1), 0, 1);
    if (next === layerRef.current) return;
    layerRef.current = next;
    targetZ.current = next === 0 ? 11 : 6.5;
    setLayer(next);
  }

  return (
    <group
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      {/* An invisible full-field plane so pointer events fire even over empty
          space between the floating modules, not just when hovering a mesh. */}
      <mesh position={[0, 0, -2]} visible={false}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial />
      </mesh>
      <group ref={group}>{children}</group>
    </group>
  );
}
