"use client";

import { EffectComposer, Bloom, DepthOfField, Vignette } from "@react-three/postprocessing";
import { CameraRig } from "./CameraRig";
import { OrbitalHero, type OrbitNode } from "./OrbitalHero";
import { FloatingModule } from "./FloatingModule";
import { ConnectionLines } from "./ConnectionLines";
import { ParticleField } from "./ParticleField";
import type { SpatialModule } from "./types";

export function Scene({
  modules,
  heroHeadline,
  heroLabel,
  heroSubLines,
  heroNodes,
}: {
  modules: SpatialModule[];
  heroHeadline: number;
  heroLabel: string;
  heroSubLines: string[];
  heroNodes: OrbitNode[];
}) {
  return (
    <>
      {/* Soft volumetric-feeling lighting — one cool key light, one warm rim,
          low ambient so the glass panels' own glow does the real work. */}
      <ambientLight intensity={0.25} />
      <pointLight position={[4, 5, 6]} intensity={1.1} color="#60a5fa" />
      <pointLight position={[-5, -3, -4]} intensity={0.5} color="#22d3ee" />
      <fog attach="fog" args={["#05070d", 8, 20]} />

      <CameraRig>
        <OrbitalHero headline={heroHeadline} headlineLabel={heroLabel} subLines={heroSubLines} nodes={heroNodes} />
        <ConnectionLines modules={modules} />
        {modules.map((m) => (
          <FloatingModule key={m.id} mod={m} />
        ))}
        <ParticleField />
      </CameraRig>

      <EffectComposer>
        <Bloom intensity={0.55} luminanceThreshold={0.25} luminanceSmoothing={0.9} mipmapBlur />
        <DepthOfField focusDistance={0.015} focalLength={0.03} bokehScale={2.5} />
        <Vignette eskil={false} offset={0.2} darkness={0.9} />
      </EffectComposer>
    </>
  );
}
