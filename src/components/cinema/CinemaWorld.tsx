"use client";

import "./cinema.css";
import { useEffect, useRef, useState } from "react";
import type { CinemaController, CinemaEngine, CinemaMode } from "./engine/engine";
import type { Quality } from "./engine/world";

declare global {
  interface Window {
    /** Debug handle to the running 3D engine. */
    __cine?: CinemaEngine;
  }
}

interface Props {
  mode: CinemaMode;
  quality: Quality;
  /** fill the viewport (landing) or just the parent box (dashboard scene) */
  fixed?: boolean;
  onController?: (c: CinemaController | null) => void;
  /** called if WebGL dies or can't start — the caller swaps back to its 2D art */
  onFail?: () => void;
  onReady?: () => void;
  className?: string;
}

/**
 * The real-time 3D canvas. three.js is imported lazily here, so none of it ships to a page (or a device)
 * that never mounts this component. Rendering pauses when the tab is hidden or the canvas scrolls away.
 */
export function CinemaWorld({ mode, quality, fixed = false, onController, onFail, onReady, className = "" }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const cbs = useRef({ onController, onFail, onReady });
  cbs.current = { onController, onFail, onReady };

  useEffect(() => {
    let engine: CinemaEngine | null = null;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    const cleanup: (() => void)[] = [];

    (async () => {
      try {
        const { CinemaEngine } = await import("./engine/engine");
        if (cancelled || !canvas.current) return;
        engine = new CinemaEngine(canvas.current, mode, quality);
        engine.onContextLost = () => cbs.current.onFail?.();
        engine.onFirstFrame = () => {
          setReady(true);
          document.documentElement.setAttribute("data-cinema", "1");
          cbs.current.onReady?.();
        };
        window.__cine = engine;
        cbs.current.onController?.(engine);
        engine.start();

        ro = new ResizeObserver(() => engine?.resize());
        if (wrap.current) ro.observe(wrap.current);

        // don't burn the GPU for something nobody can see
        let visible = true;
        const sync = () => (visible && !document.hidden ? engine?.start() : engine?.stop());
        io = new IntersectionObserver(([e]) => {
          visible = e.isIntersecting;
          sync();
        });
        if (wrap.current) io.observe(wrap.current);
        document.addEventListener("visibilitychange", sync);
        cleanup.push(() => document.removeEventListener("visibilitychange", sync));

        const onMove = (e: PointerEvent) => engine?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
        window.addEventListener("pointermove", onMove, { passive: true });
        cleanup.push(() => window.removeEventListener("pointermove", onMove));
      } catch (err) {
        console.warn("[cinema] 3D unavailable, using the illustrated scenes", err);
        cbs.current.onFail?.();
      }
    })();

    return () => {
      cancelled = true;
      cleanup.forEach((f) => f());
      ro?.disconnect();
      io?.disconnect();
      cbs.current.onController?.(null);
      document.documentElement.removeAttribute("data-cinema");
      if (window.__cine === engine) delete window.__cine;
      engine?.dispose();
    };
  }, [mode, quality]);

  return (
    <div ref={wrap} className={`cine ${fixed ? "cine--fixed" : ""} ${ready ? "is-ready" : ""} ${className}`} aria-hidden>
      <canvas ref={canvas} className="cine-canvas" />
      <div className="cine-leaves" />
    </div>
  );
}
