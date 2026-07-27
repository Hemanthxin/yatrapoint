"use client";

// Minimalist loading system. Instead of shimmer boxes, a route's loading.tsx
// shows the real app chrome (so the sidebar/top bar stay put) with the branded
// Saafera loader centred in the content area — calm, distinctive, on-brand.
import { Sidebar } from "../Sidebar";
import { DesktopNavBar } from "../DesktopNavBar";
import { SaaferaLoader } from "../SaaferaLoader";

/** A single faint placeholder block (kept for the rare inline use). */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-[color:var(--surface-2)] ${className}`}
    />
  );
}

/** The app chrome (calm canvas + real Sidebar + a quiet top bar) around a
 *  content slot. Mirrors AppShell so a loading state looks like the real page. */
export function SkeletonShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen text-[color:var(--text)]">
      <div aria-hidden className="aurora-canvas" />
      <Sidebar open={false} onClose={() => {}} />
      <DesktopNavBar />
      <div className="relative z-10">
        {/* Quiet top bar placeholder (mobile/tablet — desktop shows the real nav above) */}
        <div className="flex h-16 items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)]/70 px-4 md:px-6 lg:hidden">
          <div className="h-4 w-40 rounded-full bg-[color:var(--surface-2)]" />
          <div className="h-8 w-8 rounded-full bg-[color:var(--surface-2)]" />
        </div>
        <main className="mx-auto max-w-[1800px] px-4 py-5 pb-32 md:px-6 md:py-8 lg:px-8 lg:pb-10 2xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Full-page loading state: the chrome + the centred Saafera loader. `label`
 *  makes each page's loader read as its own ("Loading destinations…"). */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <SkeletonShell>
      <div className="grid min-h-[60vh] place-items-center">
        <SaaferaLoader label={label} />
      </div>
    </SkeletonShell>
  );
}
