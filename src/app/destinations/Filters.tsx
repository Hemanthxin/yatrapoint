"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { CATEGORIES } from "@/lib/catalog/categories";

interface FiltersProps {
  states: string[];
  districts: string[];
  // Hide the Category dropdown (used on mobile, where category chips already
  // exist above the filters — avoids two category selectors).
  hideCategory?: boolean;
  initial: {
    category?: string;
    state?: string;
    district?: string;
    q?: string;
    maxBudget?: number;
  };
}

export function Filters({ states, districts, hideCategory = false, initial }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q ?? "");

  // Keep search input in sync if back/forward changes the URL.
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  function push(next: URLSearchParams) {
    startTransition(() => {
      const qs = next.toString();
      router.push(qs ? `/destinations?${qs}` : "/destinations");
    });
  }

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value.length > 0) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  // Changing the state invalidates the chosen district (districts are per-state).
  function setState(value: string | undefined) {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value.length > 0) next.set("state", value);
    else next.delete("state");
    next.delete("district");
    push(next);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setParam("q", q.trim());
  }

  function clearAll() {
    setQ("");
    push(new URLSearchParams());
  }

  const active = ["category", "state", "district", "q", "maxBudget"].some((k) =>
    searchParams.get(k)
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 md:flex-row md:items-end"
      >
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search places, states, vibes…"
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
            />
          </div>
        </div>

        {!hideCategory && (
          <div className="md:w-44">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </label>
            <select
              value={initial.category ?? ""}
              onChange={(e) => setParam("category", e.target.value || undefined)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="md:w-44">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            State
          </label>
          <select
            value={initial.state ?? ""}
            onChange={(e) => setState(e.target.value || undefined)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          >
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="md:w-44">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            District
          </label>
          <select
            value={initial.district ?? ""}
            onChange={(e) => setParam("district", e.target.value || undefined)}
            disabled={districts.length === 0}
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="md:w-44">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Max ₹ / day
          </label>
          <select
            value={initial.maxBudget ?? ""}
            onChange={(e) => setParam("maxBudget", e.target.value || undefined)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          >
            <option value="">Any budget</option>
            <option value="1500">Under ₹1,500</option>
            <option value="2000">Under ₹2,000</option>
            <option value="2500">Under ₹2,500</option>
            <option value="3500">Under ₹3,500</option>
            <option value="5000">Under ₹5,000</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="group relative min-h-[44px] overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
        >
          {!isPending && <span aria-hidden className="sheen-overlay animate-sheen" />}
          <span className="relative">{isPending ? "…" : "Search"}</span>
        </button>
        {active && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </form>
    </div>
  );
}
