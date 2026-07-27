"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { Marquee } from "./Marquee";
import { ToastHost } from "./ToastHost";
import { Reveal } from "./Reveal";

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
      {/* Vibrant animated aurora — blue + green light behind every screen. */}
      <div aria-hidden className="aurora-canvas">
        <div className="aurora-blob -left-32 top-[-6rem] h-[26rem] w-[26rem] bg-green-300/35 animate-aurora" />
        <div className="aurora-blob right-[-8rem] top-1/4 h-[30rem] w-[30rem] bg-emerald-300/35 animate-aurora [animation-delay:-7s]" />
        <div className="aurora-blob bottom-[-6rem] left-1/4 h-[28rem] w-[28rem] bg-teal-300/30 animate-aurora [animation-delay:-14s]" />
        <div className="aurora-blob right-1/4 top-1/2 h-64 w-64 bg-teal-200/35 animate-breathe" />
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
        <Reveal as="main" className="mx-auto max-w-[1800px] px-4 py-5 pb-32 md:px-6 md:py-8 lg:px-8 lg:pb-10 2xl:px-10" amount={0}>
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
