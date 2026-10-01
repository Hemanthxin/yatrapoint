"use client";

import Link from "next/link";
import { Plus, Users } from "lucide-react";

// "Share your journey" prompt in the community right rail.
//
// The photo is a real <img> layer rather than a Tailwind `bg-gradient-*`
// class: `.card` in globals.css sets the `background` SHORTHAND, which resets
// `background-image` to none, so a gradient utility on a `.card` element
// silently disappears — which previously left this card's white-on-white text
// invisible (a blank white box). Layering an element sidesteps that entirely.
export function ShareJourneyCard() {
  return (
    <div className="card relative isolate overflow-hidden p-4 text-white">
      {/* Photo + scrim, behind the content */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-slide-mountain-coast.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover object-right"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-tr from-emerald-950/90 via-emerald-900/75 to-emerald-800/45" />

      <h2 className="text-sm font-bold drop-shadow">Share Your Journey</h2>
      <p className="mt-1 text-xs leading-relaxed text-white/85 drop-shadow">
        Your next post could be someone&apos;s perfect trip plan.
      </p>
      {/* Both actions sit on one row, so adding the second doesn't make the
          card taller — the rail's height ladder in page.tsx budgets for this
          card at its current size. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("yatra:open-composer"))}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" /> Add post
        </button>
        <Link
          href="/community/groups"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/45 bg-white/10 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
        >
          <Users className="h-3.5 w-3.5" /> Join community
        </Link>
      </div>
    </div>
  );
}
