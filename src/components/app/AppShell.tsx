"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";

interface AppShellProps {
  userLabel: string;
  userImage?: string | null;
  location?: string;
  children: React.ReactNode;
}

export function AppShell({ userLabel, userImage, location, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      {/* Ambient animated depth — soft gradient orbs drifting behind content. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl animate-blob" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-sky-300/25 blur-3xl animate-blob [animation-delay:-6s]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl animate-blob [animation-delay:-12s]" />
      </div>

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="relative z-10 lg:pl-64">
        <Topbar
          userLabel={userLabel}
          userImage={userImage}
          location={location}
          onMenu={() => setOpen((v) => !v)}
        />
        <main className="mx-auto max-w-7xl animate-fadeUp px-4 py-6 pb-28 md:px-6 md:py-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileNav onMenu={() => setOpen(true)} />
    </div>
  );
}
