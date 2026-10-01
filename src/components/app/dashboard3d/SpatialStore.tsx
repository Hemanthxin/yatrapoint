"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Shared interaction state between the WebGL scene (inside <Canvas>) and the
// HTML overlay (the dock, the deep-dive panel) living outside it — a plain
// context instead of a state library, since this dashboard is the only thing
// that needs it.
interface SpatialState {
  hoveredId: string | null;
  setHovered: (id: string | null) => void;
  selectedId: string | null;
  setSelected: (id: string | null) => void;
  // 0 = overview (the hero + modules at a comfortable distance), 1 = the
  // "deep" layer the mouse wheel dollies into — see CameraRig.
  layer: number;
  setLayer: (n: number) => void;
}

const Ctx = createContext<SpatialState | null>(null);

export function SpatialProvider({ children }: { children: ReactNode }) {
  const [hoveredId, setHovered] = useState<string | null>(null);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [layer, setLayer] = useState(0);

  const value = useMemo(
    () => ({ hoveredId, setHovered, selectedId, setSelected, layer, setLayer }),
    [hoveredId, selectedId, layer]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpatial(): SpatialState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSpatial must be used inside <SpatialProvider>");
  return ctx;
}
