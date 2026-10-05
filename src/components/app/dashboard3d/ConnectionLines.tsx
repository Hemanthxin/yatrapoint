"use client";

import type { SpatialModule } from "./types";

// Thin glowing lines from the hero (scene centre) to each module's base
// position — a simple absolute-positioned SVG overlay in percentage space,
// matching how the modules themselves are placed.
export function ConnectionLines({ modules }: { modules: SpatialModule[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
      {modules.map((m) => {
        const [x, y] = m.position;
        return (
          <line
            key={m.id}
            x1="50%"
            y1="50%"
            x2={`${x}%`}
            y2={`${y}%`}
            stroke={m.color}
            strokeWidth={1}
            strokeOpacity={0.3}
          />
        );
      })}
    </svg>
  );
}
