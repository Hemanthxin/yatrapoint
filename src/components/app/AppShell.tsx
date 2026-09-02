"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { CursorHalo } from "./CursorHalo";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { Marquee } from "./Marquee";
import { ToastHost } from "./ToastHost";
import { Reveal } from "./Reveal";

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
  children: React.ReactNode;
}

export function AppShell({ userLabel, userImage, location, immersive = false, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  // overflow-x-CLIP, not hidden: `hidden` computes to `overflow: hidden auto`,
  // which turns this wrapper into a scroll container and silently breaks
  // `position: sticky` for every descendant (the community rail and the feed's
  // sticky tab bar both failed to pin because of it). `clip` gives the same
  // horizontal clipping without creating a scrollport.
  return (
    <div className="relative min-h-screen overflow-x-clip text-slate-900">
      {/* Vibrant animated aurora — blue + green light behind every screen. */}
      <div aria-hidden className="aurora-canvas">
        <div className="aurora-blob -left-32 top-[-6rem] h-[26rem] w-[26rem] bg-green-300/35 animate-aurora" />
        <div className="aurora-blob right-[-8rem] top-1/4 h-[30rem] w-[30rem] bg-emerald-300/35 animate-aurora [animation-delay:-7s]" />
        <div className="aurora-blob bottom-[-6rem] left-1/4 h-[28rem] w-[28rem] bg-teal-300/30 animate-aurora [animation-delay:-14s]" />
        <div className="aurora-blob right-1/4 top-1/2 h-64 w-64 bg-teal-200/35 animate-breathe" />
      </div>

      {/* Blueprint grid, over the aurora and under the content. Fixed to the
          viewport so it stays put while the page scrolls, the way it does on
          Rexovi — a grid that scrolls with a long page reads as wallpaper
          rather than as a drafting surface. */}
      <span aria-hidden className="blueprint" />

      {/* Ring that trails the pointer and swells over anything clickable.
          Absent on touch devices and for reduced-motion users. */}
      <CursorHalo />

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="relative z-10 lg:pl-64">
        <div className={immersive ? "hidden lg:block" : undefined}>
          <Marquee />
          <Topbar
            userLabel={userLabel}
            userImage={userImage}
            location={location}
            onMenu={() => setOpen((v) => !v)}
          />
        </div>

        {/* With the header gone on phones, the menu becomes a floating control
            sitting on the photo itself. */}
        {immersive && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="fixed left-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition active:scale-95 lg:hidden"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}

        <Reveal
          as="main"
          className={`mx-auto max-w-[1800px] pb-32 lg:pb-10 2xl:px-10 ${
            // Full-bleed right up to the desktop breakpoint, since the mobile
            // place screen is what renders below `lg` — padding returning at
            // `md` would inset it on tablets while it is still the mobile view.
            immersive
              ? "px-0 py-0 lg:px-8 lg:py-8"
              : "px-4 py-5 md:px-6 md:py-8 lg:px-8"
          }`}
          amount={0}
        >
          {children}
        </Reveal>
      </div>

      {/* Floating mobile dock */}
      <MobileNav onMenu={() => setOpen(true)} />

      {/* App-wide transient popups (e.g. "Trip added to cart"). */}
      <ToastHost />
    </div>
  );
}
