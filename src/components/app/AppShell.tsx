"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { Marquee } from "./Marquee";

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
      {/* Calm, barely-there ambient tint (clean-minimal). */}
      <div aria-hidden className="aurora-canvas">
        <div className="aurora-blob -left-40 top-[-8rem] h-[24rem] w-[24rem] bg-emerald-200/20" />
        <div className="aurora-blob right-[-10rem] top-1/3 h-[26rem] w-[26rem] bg-sky-200/15" />
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
        </main>
      </div>

      {/* Floating mobile dock */}
      <MobileNav onMenu={() => setOpen(true)} />
    </div>
  );
}
