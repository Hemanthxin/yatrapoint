"use client";

// Instant, data-free loading skeletons. These render the moment a link is
// clicked (via each route's loading.tsx) so navigation never "hangs" waiting on
// the server — the page structure appears immediately and the real content
// streams in over it. The shell reuses the real Sidebar so the left rail stays
// pixel-identical across the transition.
import { Sidebar } from "../Sidebar";

/** A single shimmering placeholder block. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-slate-200/80 via-emerald-50 to-slate-200/80 dark:from-white/10 dark:via-emerald-400/10 dark:to-white/10 ${className}`}
    />
  );
}

/** The app chrome (aurora + real Sidebar + topbar placeholder) around a content
 *  slot. Mirrors AppShell so a loading state looks like the real screen. */
export function SkeletonShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-slate-900">
      <div aria-hidden className="aurora-canvas">
        <div className="aurora-blob -left-32 top-[-6rem] h-[26rem] w-[26rem] bg-green-300/35 animate-aurora" />
        <div className="aurora-blob right-[-8rem] top-1/4 h-[30rem] w-[30rem] bg-emerald-300/35 animate-aurora [animation-delay:-7s]" />
        <div className="aurora-blob bottom-[-6rem] left-1/4 h-[28rem] w-[28rem] bg-teal-300/30 animate-aurora [animation-delay:-14s]" />
        <div className="aurora-blob right-1/4 top-1/2 h-64 w-64 bg-teal-200/35 animate-breathe" />
      </div>

      <Sidebar open={false} onClose={() => {}} />

      <div className="relative z-10 lg:pl-64">
        {/* Marquee strip placeholder */}
        <div className="h-9 w-full bg-slate-900/5" />
        {/* Topbar placeholder */}
        <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl lg:hidden" />
            <Skeleton className="h-5 w-44 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="hidden h-9 w-40 rounded-full sm:block" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>

        <main className="mx-auto max-w-7xl animate-fadeIn px-4 py-5 pb-32 md:px-6 md:py-8 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Page title + subtitle placeholder. */
export function SkeletonHeader() {
  return (
    <header className="mb-5">
      <Skeleton className="h-9 w-56 rounded-2xl md:h-10 md:w-72" />
      <Skeleton className="mt-2 h-4 w-40 rounded-full" />
    </header>
  );
}

/** A row of pill/chip placeholders (category chips, tabs). */
export function SkeletonChips({ count = 6 }: { count?: number }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-24 rounded-full" />
      ))}
    </div>
  );
}

/** A destination/place card placeholder — matches DestinationCard's shape. */
export function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-emerald-500/5">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <Skeleton className="h-3.5 w-full rounded-full" />
        <Skeleton className="h-3.5 w-4/5 rounded-full" />
        <Skeleton className="mt-1 h-10 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/** A responsive grid of card placeholders. */
export function SkeletonCardGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Full listing page: header + chips + filter bar + card grid.
 *  Used by /destinations, /hidden-places, /trip-categories, /explore-bangalore. */
export function ListingSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div>
      <SkeletonHeader />
      <SkeletonChips />
      <Skeleton className="h-[72px] w-full rounded-3xl" />
      <SkeletonCardGrid count={cards} />
    </div>
  );
}

/** A place/trip detail page: hero image + title block + info cards + body. */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full rounded-3xl md:h-80" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3 rounded-2xl" />
        <Skeleton className="h-4 w-1/3 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-5/6 rounded-full" />
        <Skeleton className="h-4 w-3/4 rounded-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-3xl" />
    </div>
  );
}

/** Generic page: header + a few stacked panels. Used where a bespoke skeleton
 *  isn't worth it (settings, faq, budget planner form, etc.). */
export function PanelSkeleton({ panels = 3 }: { panels?: number }) {
  return (
    <div>
      <SkeletonHeader />
      <div className="space-y-4">
        {Array.from({ length: panels }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

/** Dashboard: greeting + stat tiles + a couple of wide panels. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 rounded-2xl md:h-10" />
        <Skeleton className="h-4 w-48 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <SkeletonCardGrid count={4} />
      <Skeleton className="h-56 w-full rounded-3xl" />
    </div>
  );
}
