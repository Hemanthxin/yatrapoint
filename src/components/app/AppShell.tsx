"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { Marquee } from "./Marquee";
import { FestivalTicker } from "./FestivalTicker";

interface AppShellProps {
  userLabel: string;
  userImage?: string | null;
  location?: string;
  children: React.ReactNode;
}

export function AppShell({ userLabel, userImage, location, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-slate-900">
      {/* Immersive aurora canvas — drifting, breathing gradient light that lives
          behind every screen and gives the whole app depth. */}
      <div aria-hidden className="aurora-canvas">
        <div className="aurora-blob -left-32 top-[-6rem] h-[26rem] w-[26rem] bg-emerald-300/40 animate-aurora" />
        <div className="aurora-blob right-[-8rem] top-1/4 h-[30rem] w-[30rem] bg-sky-300/30 animate-aurora [animation-delay:-7s]" />
        <div className="aurora-blob bottom-[-6rem] left-1/4 h-[28rem] w-[28rem] bg-violet-300/25 animate-aurora [animation-delay:-14s]" />
        <div className="aurora-blob right-1/4 top-1/2 h-64 w-64 bg-amber-200/30 animate-breathe" />
      </div>

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="relative z-10 lg:pl-64">
        <Marquee />
        <Topbar
          userLabel={userLabel}
          userImage={userImage}
          location={location}
          onMenu={() => setOpen((v) => !v)}
        />
        <main className="mx-auto max-w-7xl animate-fadeUp px-4 py-5 pb-32 md:px-6 md:py-8 lg:pb-10">
          {children}
          {/* Footer festivals ticker — next upcoming festival first */}
          <FestivalTicker />
        </main>
      </div>

      {/* Floating mobile dock */}
      <MobileNav onMenu={() => setOpen(true)} />
    </div>
  );
}
