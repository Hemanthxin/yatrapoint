"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";

export function Filters({
  states,
  categories,
  current,
}: {
  states: string[];
  categories: string[];
  current: { q?: string; state?: string; category?: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState(current.q ?? "");

  function push(next: { q?: string; state?: string; category?: string }) {
    const params = new URLSearchParams();
    const merged = { q, state: current.state, category: current.category, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.state) params.set("state", merged.state);
    if (merged.category) params.set("category", merged.category);
    router.push(`/admin/places${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    push({ q });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center">
      <form onSubmit={onSubmit} className="group relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-indigo-600" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search places by name, district…"
          className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)]"
        />
      </form>

      <select
        value={current.state ?? ""}
        onChange={(e) => push({ state: e.target.value || undefined })}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)] sm:w-auto"
      >
        <option value="">All states</option>
        {states.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select
        value={current.category ?? ""}
        onChange={(e) => push({ category: e.target.value || undefined })}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)] sm:w-auto"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {(current.q || current.state || current.category) && (
        <button
          onClick={() => {
            setQ("");
            router.push("/admin/places");
          }}
          className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95 sm:w-auto"
        >
          Clear
        </button>
      )}
    </div>
  );
}
