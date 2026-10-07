"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { CursorHalo } from "./CursorHalo";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { Marquee } from "./Marquee";
import { ToastHost } from "./ToastHost";
import { Reveal } from "./Reveal";
import { SaaferaAssistant } from "./SaaferaAssistant";
import { PaintedBackdrop } from "@/components/storybook/MountainScape";

interface AppShellProps {
  userLabel: string;
  userImage?: string | null;
  location?: string;
  // Full-bleed mode for a place screen: on phones the news marquee, the top bar
  // and the main padding all go, so the hero photo starts at the very top of
  // the viewport. The menu survives as a floating button over the image —
  // dropping the header outright would strand the traveller with no way out.
  // Desktop is unaffected and keeps the full chrome.
  immersive?: boolean;
  // Full-screen 3D spatial takeover (the dashboard's "3D data universe") —
  // DESKTOP (lg+) ONLY: no permanent sidebar rail, no topbar/marquee, no
  // light aurora/blueprint backdrop, the page's own dark scene fills the
  // viewport and its own floating dock replaces nav. Below `lg` this has no
  // effect at all — phones keep the completely normal chrome (topbar, mobile
  // dock, scrollable page), since the spatial page itself only renders its
  // WebGL scene at desktop widths and falls back to the ordinary mobile
  // dashboard underneath it.
  spatial?: boolean;
  children: React.ReactNode;
}

export function AppShell({ userLabel, userImage, location, immersive = false, spatial = false, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  // The Marquee+Topbar header used to be `position: sticky`, which turned
  // out to be unreliable in this exact nested structure — confirmed by
  // direct testing: an identical clone of the header, moved to document.body,
  // stuck correctly; the real one, even with `position: sticky !important`
  // forced inline, did not (it scrolled away like a normal in-flow element).
  // `position: fixed` on the same element in the same spot works reliably,
  // so the header is fixed to the viewport instead, with its real rendered
  // height measured and applied as top padding on the content that follows
  // it — otherwise fixed positioning would pull it out of flow and the page
  // content would start underneath it.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      const h = el.offsetHeight;
      setHeaderHeight(h);
      // Exposed for any page-level sticky element that needs to clear the
      // header (e.g. a secondary sticky search bar or filter row) — those
      // used to hardcode `top-16` assuming the header was exactly 64px
      // (Topbar alone), which silently stopped matching reality once the
      // marquee's height was also part of the fixed region above it.
      document.documentElement.style.setProperty("--app-header-h", `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [immersive, spatial]);

  // overflow-x-CLIP, not hidden: `hidden` computes to `overflow: hidden auto`,
  // which turns this wrapper into a scroll container and silently breaks
  // `position: sticky` for every descendant (the community rail and the feed's
  // sticky tab bar both failed to pin because of it). `clip` gives the same
  // horizontal clipping without creating a scrollport.
  return (
    <div className="relative min-h-screen overflow-x-clip overflow-y-visible text-slate-900">
      {/* Vibrant animated aurora — blue + green light behind every screen.
          Hidden at desktop width for the spatial dashboard, which paints its
          own scene there; phones keep it regardless. */}
      <div aria-hidden className={`aurora-canvas ${spatial ? "lg:hidden" : ""}`}>
        <div className="aurora-blob -left-32 top-[-6rem] h-[26rem] w-[26rem] bg-green-300/35 animate-aurora" />
        <div className="aurora-blob right-[-8rem] top-1/4 h-[30rem] w-[30rem] bg-emerald-300/35 animate-aurora [animation-delay:-7s]" />
        <div className="aurora-blob bottom-[-6rem] left-1/4 h-[28rem] w-[28rem] bg-teal-300/30 animate-aurora [animation-delay:-14s]" />
        <div className="aurora-blob right-1/4 top-1/2 h-64 w-64 bg-teal-200/35 animate-breathe" />
        {/* Painted mountain horizon (desktop storybook theme; hidden below lg). */}
        <PaintedBackdrop />
      </div>

      {/* Blueprint grid, over the aurora and under the content. Fixed to the
          viewport so it stays put while the page scrolls, the way it does on
          Rexovi — a grid that scrolls with a long page reads as wallpaper
          rather than as a drafting surface. */}
      <span aria-hidden className={`blueprint ${spatial ? "lg:hidden" : ""}`} />

      {/* Ring that trails the pointer and swells over anything clickable.
          Absent on touch devices and for reduced-motion users. */}
      <CursorHalo />

      <Sidebar open={open} onClose={() => setOpen(false)} forceOverlay={spatial} />

      <div className={`relative z-10 ${spatial ? "lg:pl-0" : "lg:pl-64"}`}>
        <div
          ref={headerRef}
          className={`fixed inset-x-0 top-0 z-20 ${spatial ? "lg:hidden" : immersive ? "hidden lg:block" : ""} ${spatial ? "" : "lg:left-64"}`}
        >
          <Marquee />
          <Topbar
            userLabel={userLabel}
            userImage={userImage}
            location={location}
            onMenu={() => setOpen((v) => !v)}
          />
        </div>
        {/* Fixed positioning (above) pulls the header out of document flow —
            this reserves the same space it used to occupy so content starts
            right below it instead of underneath it. */}
        <div
          aria-hidden
          style={{ height: headerHeight }}
          className={spatial ? "lg:hidden" : immersive ? "hidden lg:block" : undefined}
        />

        {/* With the header gone on phones, the menu becomes a floating control
            sitting on the photo itself. */}
        {immersive && !spatial && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="fixed left-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition active:scale-95 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Reveal
          as="main"
          className={
            spatial
              ? // Normal padded/scrollable phone layout (matches the plain
                // default below), full-bleed fixed-height takeover at lg+
                // where the 3D scene itself fills the viewport.
                "mx-auto max-w-[1800px] px-4 py-5 pb-32 md:px-6 md:py-8 lg:h-screen lg:max-w-none lg:overflow-hidden lg:p-0 lg:pb-0"
              : immersive
                ? "mx-auto max-w-[1800px] px-0 py-0 pb-32 lg:px-8 lg:py-8 lg:pb-10 2xl:px-10"
                : "mx-auto max-w-[1800px] px-4 py-5 pb-32 md:px-6 md:py-8 lg:px-8 lg:pb-10 2xl:px-10"
          }
          amount={0}
        >
          {children}
        </Reveal>
      </div>

      {/* Floating mobile dock — the spatial dashboard's desktop view has its
          own floating dock instead; this already hides itself at lg+. */}
      <MobileNav onMenu={() => setOpen(true)} />

      {/* App-wide transient popups (e.g. "Trip added to cart"). */}
      <ToastHost />

      {/* Globally accessible AI chat — trip advice + app help. */}
      <SaaferaAssistant />
    </div>
  );
}
