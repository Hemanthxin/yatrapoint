"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Share2, Check } from "lucide-react";
import { toggleSaveLongTrip } from "@/lib/actions/long-trips";

export function TripActions({
  longTripId,
  initialSaved,
  title,
}: {
  longTripId: string;
  initialSaved: boolean;
  title: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function onSave() {
    // Optimistic — the server action reconciles on the next real check.
    setSaved((v) => !v);
    startTransition(async () => {
      const res = await toggleSaveLongTrip(longTripId);
      if (res.ok) setSaved(res.saved);
    });
  }

  async function onShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy-link
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — nothing more we can do here */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-sm font-bold transition active:scale-95 ${
          saved
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        {saved ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={onShare}
        className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
        {copied ? "Link copied" : "Share"}
      </button>
    </div>
  );
}
