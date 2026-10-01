"use client";

import { useState } from "react";
import { Check, Loader2, MapPin, X } from "lucide-react";
import type { FestivalSuggestion } from "@/lib/db/schema";
import { reviewFestivalSuggestion } from "@/lib/actions/festival-suggestions";

// BUG-10: the admin side of community festival submissions. Nothing a
// traveller submits reaches /festivals until it is approved here.
export function SuggestionsQueue({ initial }: { initial: FestivalSuggestion[] }) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, decision: "approved" | "rejected") {
    setError(null);
    setBusyId(id);
    const res = await reviewFestivalSuggestion(id, decision);
    setBusyId(null);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save that decision.");
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
        No festival suggestions waiting for review.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</p>
      )}
      {rows.map((s) => (
        <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-extrabold tracking-tight text-slate-900">{s.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                {s.hub && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {s.hub}
                  </span>
                )}
                <span>{s.dateISO || s.dateLabel || "No date given"}</span>
                <span>· by {s.submittedByName || "a traveller"}</span>
              </p>
              {s.significance && (
                <p className="mt-2 max-w-2xl text-sm text-slate-600">{s.significance}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => decide(s.id, "approved")}
                disabled={busyId === s.id}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
              >
                {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve
              </button>
              <button
                type="button"
                onClick={() => decide(s.id, "rejected")}
                disabled={busyId === s.id}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
              >
                <X className="h-4 w-4" /> Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
