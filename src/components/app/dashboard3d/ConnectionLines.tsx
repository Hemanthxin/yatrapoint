"use client";

import { Line } from "@react-three/drei";
import type { SpatialModule } from "./types";

// Thin glowing lines from the hero to each module's BASE position — a
// deliberate simplification: tracking every module's live hover/select
// offset every frame would mean rebuilding N line geometries per frame for a
// purely decorative element. The base positions barely move (hover nudges
// are a few tenths of a unit), so the connection reads as attached either way.
export function ConnectionLines({ modules }: { modules: SpatialModule[] }) {
  return (
    <>
      {modules.map((m) => (
        <Line
          key={m.id}
          points={[
            [0, 0.2, 0],
            m.position,
          ]}
          color={m.color}
          transparent
          opacity={0.22}
          lineWidth={1}
        />
      ))}
    </>
  );
}
