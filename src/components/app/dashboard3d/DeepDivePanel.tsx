"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { useSpatial } from "./SpatialStore";
import type { SpatialModule } from "./types";

// The "additional data panels unfold around it" part of a focused deep-dive —
// rendered as a normal HTML overlay (not WebGL) specifically so the actual
// detail content stays easy to read and lay out, while the selected module
// itself flies to centre-stage behind it in the 3D scene.
export function DeepDivePanel({ modules }: { modules: SpatialModule[] }) {
  const { selectedId, setSelected } = useSpatial();
  const active = modules.find((m) => m.id === selectedId) ?? null;
  const Icon = active?.icon;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 40, scale: 0.96 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto fixed bottom-28 right-4 top-24 z-30 w-[min(92vw,22rem)] overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-white shadow-2xl backdrop-blur-2xl lg:bottom-8 lg:right-8 lg:top-28"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {Icon && (
                <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: `${active.color}22`, color: active.color }}>
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">{active.label}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4">{active.renderDeepDive()}</div>

          <Link
            href={active.href}
            className="mt-5 flex items-center justify-center rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Open {active.label}
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
