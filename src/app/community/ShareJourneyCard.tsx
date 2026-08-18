"use client";

import { Camera } from "lucide-react";

// A real button, not decoration — dispatches a DOM event that <Feed>
// (rendered separately in the page tree) listens for to open its composer.
export function ShareJourneyCard() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("yatra:open-composer"))}
      className="card w-full space-y-2 overflow-hidden bg-gradient-to-br from-emerald-700 to-teal-700 p-4 text-left text-white transition hover:brightness-105 active:scale-[0.98]"
    >
      <Camera className="h-6 w-6" />
      <h2 className="text-sm font-bold">Share Your Journey</h2>
      <p className="text-xs text-white/80">Your next post could be someone's perfect trip plan.</p>
      <span className="mt-1 inline-block text-xs font-bold underline underline-offset-2">Create Post →</span>
    </button>
  );
}
