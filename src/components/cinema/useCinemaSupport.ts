"use client";

import { useEffect, useState } from "react";
import type { Quality } from "./engine/world";

export interface Support {
  ok: boolean;
  quality: Quality;
  reason?: string;
}

/**
 * Decides, once on the client, whether this visitor gets the real-time 3D world — and at which quality.
 * Everything else keeps the existing illustrated scenes (the 2D art is the fallback, never removed).
 *
 *   • desktop-width screens with a fine pointer only (phones/tablets never download three.js)
 *   • WebGL2 must actually create a context
 *   • honours prefers-reduced-motion, Save-Data and very low-memory devices
 *   • `?cinema=off` / localStorage "saafera/cinema" = "off" is a manual opt-out; "on" forces it
 */
export function useCinemaSupport(): Support | null {
  const [s, setS] = useState<Support | null>(null);
  useEffect(() => {
    setS(detect());
  }, []);
  return s;
}

export function detect(): Support {
  try {
    const q = new URLSearchParams(window.location.search).get("cinema");
    const stored = localStorage.getItem("saafera/cinema");
    if (q === "off" || stored === "off") return { ok: false, quality: "low", reason: "opt-out" };
  } catch {
    /* storage blocked — carry on */
  }
  if (!window.matchMedia("(min-width: 1024px)").matches) return { ok: false, quality: "low", reason: "narrow" };
  if (!window.matchMedia("(pointer: fine)").matches) return { ok: false, quality: "low", reason: "touch" };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return { ok: false, quality: "low", reason: "reduced-motion" };
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return { ok: false, quality: "low", reason: "save-data" };
  if (nav.deviceMemory && nav.deviceMemory <= 2) return { ok: false, quality: "low", reason: "low-memory" };
  let gl2 = false;
  try {
    const c = document.createElement("canvas");
    gl2 = !!c.getContext("webgl2");
  } catch {
    gl2 = false;
  }
  if (!gl2) return { ok: false, quality: "low", reason: "no-webgl2" };
  const cores = navigator.hardwareConcurrency || 4;
  const quality: Quality = cores >= 8 && (window.devicePixelRatio || 1) <= 2.5 ? "high" : cores >= 4 ? "medium" : "low";
  return { ok: true, quality };
}
