"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { CATEGORIES } from "@/lib/catalog/categories";

interface PlannerFormProps {
  initial: {
    budget?: number;
    days?: number;
    travellers?: number;
    category?: string;
  };
}

export function PlannerForm({ initial }: PlannerFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [budget, setBudget] = useState(initial.budget?.toString() ?? "");
  const [days, setDays] = useState(initial.days?.toString() ?? "");
  const [travellers, setTravellers] = useState(
    initial.travellers?.toString() ?? "2"
  );
  const [category, setCategory] = useState(initial.category ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (budget) next.set("budget", budget);
    else next.delete("budget");
    if (days) next.set("days", days);
    else next.delete("days");
    if (travellers) next.set("travellers", travellers);
    else next.delete("travellers");
    if (category) next.set("category", category);
    else next.delete("category");
    startTransition(() => router.push(`/budget-planner?${next.toString()}`));
  }

  return (
    <form
      onSubmit={onSubmit}
      className="animate-fadeUp rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Field label="Total budget (₹)" hint="Whole trip, all travellers">
          <input
            type="number"
            inputMode="numeric"
            min={500}
            step={500}
            placeholder="20000"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            required
            className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          />
        </Field>
        <Field label="Days">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            placeholder="5"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            required
            className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          />
        </Field>
        <Field label="Travellers">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={travellers}
            onChange={(e) => setTravellers(e.target.value)}
            className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          />
        </Field>
        <Field label="Category" hint="Optional vibe filter">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          >
            <option value="">Any category</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="group relative min-h-[48px] overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
        >
          {!isPending && <span aria-hidden className="sheen-overlay animate-sheen" />}
          <span className="relative">{isPending ? "Matching…" : "Find matching trips"}</span>
        </button>
        <p className="text-xs text-slate-500">
          Budgets are mid-range estimates (stay + food + local transport + sightseeing).
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}
