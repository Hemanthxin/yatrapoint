"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";

declare global {
  interface Window {
    /** The shared smooth-scroll instance (null on routes/devices that opt out). */
    __sbLenis?: Lenis | null;
  }
}

// Screens that own their own scrolling (snap feeds, live maps, the 3D scene) —
// hijacking the wheel there would fight the page, so smooth-scroll stays off.
const NO_SMOOTH = [/^\/community\/reels/, /^\/multi-stop\/live/, /\/live$/];

const BRUSH_DAY = ["201,120,46", "93,136,72", "214,120,110", "120,150,190", "201,151,58"];
const BRUSH_NIGHT = ["238,197,106", "130,150,255", "214,140,200", "120,200,200", "246,217,142"];

/**
 * The runtime half of the "painted storybook" theme (desktop + fine pointer +
 * no reduced-motion only):
 *   • Lenis smooth scrolling, wired into GSAP ScrollTrigger
 *   • a watercolour brush trail that follows the pointer
 *   • a painted-wipe reveal on page headlines
 *   • `[data-sb-parallax]` scroll parallax
 *   • drift for the fixed painted horizon behind the app
 * Nothing here mutates React-owned text nodes (reveals animate the element's
 * own style), so it cannot desync the virtual DOM.
 */
export function StorybookEffects() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const api = useRef<{ onPath: () => void } | null>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const fine = window.matchMedia("(pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let teardown: (() => void) | null = null;

    async function boot() {
      if (teardown || !desktop.matches || !fine.matches || calm.matches) return;
      const [{ default: LenisCtor }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || teardown) return;
      gsap.registerPlugin(ScrollTrigger);

      /* ── smooth scroll ─────────────────────────────────────────────── */
      let lenis: Lenis | null = null;
      let offScroll: (() => void) | null = null;
      const tick = (t: number) => lenis?.raf(t * 1000);

      const wantSmooth = () => !NO_SMOOTH.some((re) => re.test(pathRef.current));
      const syncLenis = () => {
        if (wantSmooth() && !lenis) {
          lenis = new LenisCtor({
            lerp: 0.085,
            wheelMultiplier: 0.95,
            allowNestedScroll: true,
            prevent: (n) => !!n.closest?.(".leaflet-container, [data-lenis-prevent], [role='dialog'], textarea, select"),
          });
          window.__sbLenis = lenis;
          lenis.on("scroll", ScrollTrigger.update);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);
        } else if (!wantSmooth() && lenis) {
          gsap.ticker.remove(tick);
          lenis.destroy();
          lenis = null;
          window.__sbLenis = null;
        }
      };
      syncLenis();

      /* ── painted horizon drift ─────────────────────────────────────── */
      const onScroll = () => {
        const el = document.querySelector<HTMLElement>(".sb-backdrop");
        if (!el) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        el.style.transform = `translate3d(0, ${(p * 7).toFixed(2)}vh, 0)`;
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();

      /* ── brush trail ───────────────────────────────────────────────── */
      const canvas = document.createElement("canvas");
      canvas.className = "sb-brush";
      canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const size = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      size();
      window.addEventListener("resize", size);

      type Stamp = { x: number; y: number; r: number; life: number; c: string };
      const stamps: Stamp[] = [];
      let lx = -1;
      let ly = -1;
      let ci = 0;
      let raf = 0;
      const draw = () => {
        raf = 0;
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = stamps.length - 1; i >= 0; i--) {
          const s = stamps[i];
          s.life -= 0.022;
          if (s.life <= 0) {
            stamps.splice(i, 1);
            continue;
          }
          s.r += 0.18;
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
          g.addColorStop(0, `rgba(${s.c},${(s.life * 0.34).toFixed(3)})`);
          g.addColorStop(0.55, `rgba(${s.c},${(s.life * 0.16).toFixed(3)})`);
          g.addColorStop(1, `rgba(${s.c},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        if (stamps.length) raf = requestAnimationFrame(draw);
      };
      const onMove = (e: PointerEvent) => {
        const d = Math.hypot(e.clientX - lx, e.clientY - ly);
        if (lx >= 0 && d < 14) return;
        lx = e.clientX;
        ly = e.clientY;
        const night = document.documentElement.getAttribute("data-theme") === "dark";
        const pal = night ? BRUSH_NIGHT : BRUSH_DAY;
        if (d > 90) ci = (ci + 1) % pal.length;
        stamps.push({ x: lx, y: ly, r: 9 + Math.min(d, 60) * 0.25, life: 1, c: pal[ci % pal.length] });
        if (stamps.length > 46) stamps.shift();
        if (!raf) raf = requestAnimationFrame(draw);
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      /* ── per-page reveals ──────────────────────────────────────────── */
      const revealHeads = () => {
        document.querySelectorAll<HTMLElement>("main h1:not([data-sb-done]), [data-sb-reveal]:not([data-sb-done])").forEach((el) => {
          el.setAttribute("data-sb-done", "1");
          gsap.fromTo(
            el,
            { clipPath: "inset(-12% 102% -12% -2%)", y: 22, opacity: 0.001 },
            { clipPath: "inset(-12% -2% -12% -2%)", y: 0, opacity: 1, duration: 1.15, ease: "power3.out", delay: 0.08, clearProps: "clipPath,transform" },
          );
        });
        document.querySelectorAll<HTMLElement>("[data-sb-parallax]:not([data-sb-done])").forEach((el) => {
          el.setAttribute("data-sb-done", "1");
          const speed = parseFloat(el.dataset.sbParallax || "0.2");
          gsap.to(el, {
            yPercent: -speed * 100,
            ease: "none",
            scrollTrigger: { trigger: el.parentElement || el, start: "top bottom", end: "bottom top", scrub: true },
          });
        });
      };
      revealHeads();
      const mo = new MutationObserver(() => revealHeads());
      mo.observe(document.body, { childList: true, subtree: true });

      api.current = {
        onPath: () => {
          syncLenis();
          if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
          window.setTimeout(() => {
            revealHeads();
            ScrollTrigger.refresh();
            onScroll();
          }, 120);
        },
      };

      teardown = () => {
        api.current = null;
        mo.disconnect();
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", size);
        window.removeEventListener("pointermove", onMove);
        if (raf) cancelAnimationFrame(raf);
        canvas.remove();
        gsap.ticker.remove(tick);
        lenis?.destroy();
        window.__sbLenis = null;
        ScrollTrigger.getAll().forEach((t) => t.kill());
        document.querySelectorAll("[data-sb-done]").forEach((el) => el.removeAttribute("data-sb-done"));
      };
    }

    const onChange = () => {
      if (desktop.matches && fine.matches && !calm.matches) void boot();
      else if (teardown) {
        teardown();
        teardown = null;
      }
    };
    void boot();
    desktop.addEventListener("change", onChange);
    return () => {
      cancelled = true;
      desktop.removeEventListener("change", onChange);
      teardown?.();
      teardown = null;
    };
  }, []);

  useEffect(() => {
    api.current?.onPath();
  }, [pathname]);

  return null;
}
