"use client";

import { useState } from "react";
import Image from "next/image";
import { ThumbsUp, Star, Check, X, Route, Loader2 } from "lucide-react";

import type { SuggestionWithVotes } from "@/lib/queries/group-trips";
import { voteOnSuggestion, decideSuggestion, generateItinerary } from "@/lib/actions/group-trips";
import { showToast } from "@/lib/toast";

const VOTE_OPTIONS = [
  { value: "interested" as const, label: "Interested", emoji: "👍" },
  { value: "mustVisit" as const, label: "Must Visit", emoji: "⭐" },
  { value: "notInterested" as const, label: "Not Interested", emoji: "👎" },
];

export function VoteTab({
  suggestions,
  isAdmin,
  tripId,
  confirmedCount = 0,
  onChange,
}: {
  suggestions: SuggestionWithVotes[];
  isAdmin: boolean;
  tripId?: string;
  confirmedCount?: number;
  onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const open = suggestions.filter((s) => s.status === "suggested");
  const decided = suggestions.filter((s) => s.status !== "suggested");

  async function vote(id: string, value: (typeof VOTE_OPTIONS)[number]["value"]) {
    setBusyId(id);
    const res = await voteOnSuggestion(id, value);
    setBusyId(null);
    if (!res.ok) return showToast(res.error ?? "Could not save your vote", "⚠️");
    onChange();
  }

  async function decide(id: string, decision: "confirmed" | "rejected") {
    setBusyId(id);
    const res = await decideSuggestion(id, decision);
    setBusyId(null);
    if (!res.ok) return showToast(res.error ?? "Could not save that decision", "⚠️");
    onChange();
  }

  async function onGenerate() {
    if (!tripId) return;
    setGenerating(true);
    const res = await generateItinerary(tripId);
    setGenerating(false);
    if (!res.ok) return showToast(res.error ?? "Could not generate the itinerary", "⚠️");
    showToast("Itinerary generated!", "🗺️");
    onChange();
  }

  if (suggestions.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No places suggested yet — add some in the Add Places tab.</p>;
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || confirmedCount === 0}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
          {generating ? "Generating…" : confirmedCount === 0 ? "Confirm at least one place first" : "Generate Itinerary"}
        </button>
      )}

      <div className="space-y-2">
        {open.map((s) => (
          <div key={s.id} className="card p-3">
            <div className="flex items-center gap-3">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {s.place.imageUrl && <Image src={s.place.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{s.place.name}</span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  {s.place.googleRating ? (
                    <>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {s.place.googleRating.toFixed(1)} ·{" "}
                    </>
                  ) : null}
                  Suggested by {s.suggestedByName || "a member"}
                </span>
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {VOTE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => vote(s.id, o.value)}
                  disabled={busyId === s.id}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition ${
                    s.myVote === o.value ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {o.emoji} {o.label} · {s.votes[o.value]}
                </button>
              ))}
              <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                <ThumbsUp className="h-3 w-3" /> {s.votes.interested + s.votes.mustVisit}/{s.votes.interested + s.votes.mustVisit + s.votes.notInterested} want to visit
              </span>
            </div>

            {isAdmin && (
              <div className="mt-2.5 flex gap-2 border-t border-slate-100 pt-2.5">
                <button
                  type="button"
                  onClick={() => decide(s.id, "confirmed")}
                  disabled={busyId === s.id}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" /> Add to Itinerary
                </button>
                <button
                  type="button"
                  onClick={() => decide(s.id, "rejected")}
                  disabled={busyId === s.id}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {decided.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Decided</p>
          {decided.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-600">{s.place.name}</span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  s.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                }`}
              >
                {s.status === "confirmed" ? "In itinerary" : "Removed"}
              </span>
              {/* A decision isn't permanent — the admin can move a place back
                  the other way (e.g. undo an accidental "Remove", or drop a
                  place they confirmed earlier) right up until the itinerary
                  is generated. */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => decide(s.id, s.status === "confirmed" ? "rejected" : "confirmed")}
                  disabled={busyId === s.id}
                  className="shrink-0 text-[11px] font-bold text-emerald-700 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {s.status === "confirmed" ? "Remove" : "Add back"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
