"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Save } from "lucide-react";
import type { Destination } from "@/lib/db/schema";
import { DestinationCard } from "@/components/app/DestinationCard";
import { formatINR } from "@/lib/format";
import { saveTripPlan } from "@/lib/actions/trip-plans";

interface PlannerResultsProps {
  matches: Destination[];
  favIds: Set<string>;
  summary: {
    totalBudget: number;
    days: number;
    travellers: number;
    category?: string;
    perPersonPerDay: number;
  };
}

export function PlannerResults({ matches, favIds, summary }: PlannerResultsProps) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [planName, setPlanName] = useState(
    `Trip · ${summary.days} day${summary.days > 1 ? "s" : ""}`
  );
  const [isSaving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  function onSave() {
    setError(null);
    startSave(async () => {
      const res = await saveTripPlan({
        name: planName.trim() || "Untitled trip",
        totalBudget: summary.totalBudget,
        days: summary.days,
        travellers: summary.travellers,
        category: summary.category,
        destinationIds: Array.from(picked),
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save the trip");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="mt-8 animate-fadeUp">
      <div className="mb-4 animate-pop overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 p-5 shadow-lg shadow-emerald-500/20 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_90%_-10%,rgba(255,255,255,0.3),transparent_55%)]" />
          <span aria-hidden className="sheen-overlay animate-sheen" />
          <p className="relative text-xs font-bold uppercase tracking-[0.15em] text-white/85">Total budget</p>
          <p className="relative mt-1 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {formatINR(summary.totalBudget)}
          </p>
          <p className="relative mt-1 text-sm font-semibold text-white/85">
            {formatINR(summary.perPersonPerDay)} per person / day
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Stat label="Per person / day" value={formatINR(summary.perPersonPerDay)} />
            <Stat label="Days" value={summary.days.toString()} />
            <Stat label="Travellers" value={summary.travellers.toString()} />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Showing destinations where the mid-range daily budget fits within{" "}
            {formatINR(summary.perPersonPerDay)} per person.
          </p>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            Nothing fits within {formatINR(summary.perPersonPerDay)} per person per day.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Try more days, fewer travellers, or a higher total budget.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
              {matches.length} matching {matches.length === 1 ? "destination" : "destinations"}
            </h2>
            <p className="text-xs text-slate-500">
              Tap to pick the ones you want to save into a trip plan.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((d) => {
              const isPicked = picked.has(d.id);
              return (
                <div key={d.id} className="relative">
                  <button
                    type="button"
                    onClick={() => toggle(d.id)}
                    aria-pressed={isPicked}
                    className={`absolute left-3 top-3 z-20 inline-flex min-h-[36px] items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm backdrop-blur transition active:scale-95 ${
                      isPicked
                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30"
                        : "bg-white/90 text-slate-700 hover:bg-white"
                    }`}
                  >
                    {isPicked ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Picked
                      </>
                    ) : (
                      "Pick"
                    )}
                  </button>
                  <DestinationCard destination={d} favored={favIds.has(d.id)} />
                </div>
              );
            })}
          </div>

          {picked.size > 0 && (
            <div className="sticky bottom-4 mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[12rem] flex-1">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Save as
                  </label>
                  <input
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                  />
                </div>
                <p className="text-sm font-semibold text-slate-600">
                  {picked.size} {picked.size === 1 ? "place" : "places"} selected
                </p>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving…" : saved ? "Saved" : "Save trip"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
              {saved && (
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  Saved. Your trip plan is now in the database — check{" "}
                  <a className="underline" href="/profile">
                    your profile
                  </a>
                  .
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center sm:text-left">
      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{label}</p>
      <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
