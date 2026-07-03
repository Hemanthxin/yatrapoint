"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";

interface CurrentFilters {
  q?: string;
  city?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  sort?: string;
}

const inputCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const selectCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function Filters({
  cities,
  current,
}: {
  cities: { city: string; count: number }[];
  current: CurrentFilters;
}) {
  const router = useRouter();
  const [q, setQ] = useState(current.q ?? "");
  const [city, setCity] = useState(current.city ?? "");
  const [minPrice, setMinPrice] = useState(current.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(current.maxPrice ?? "");
  const [minRating, setMinRating] = useState(current.minRating ?? "");
  const [sort, setSort] = useState(current.sort ?? "");

  const hasFilters = Boolean(
    current.q ||
      current.city ||
      current.minPrice ||
      current.maxPrice ||
      current.minRating ||
      current.sort
  );

  function push(next?: Partial<Record<string, string>>) {
    const merged: Record<string, string> = {
      q,
      city,
      minPrice,
      maxPrice,
      minRating,
      sort,
      ...next,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v != null && String(v).trim() !== "") params.set(k, String(v).trim());
    }
    const qs = params.toString();
    router.push(`/stays${qs ? `?${qs}` : ""}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    push();
  }

  function clearAll() {
    setQ("");
    setCity("");
    setMinPrice("");
    setMaxPrice("");
    setMinRating("");
    setSort("");
    router.push("/stays");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
    >
      {/* Search */}
      <div className="group relative min-w-0 flex-1 sm:min-w-[220px]">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-emerald-600" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search hotels, area…"
          aria-label="Search stays"
          className={`${inputCls} pl-10`}
        />
      </div>

      {/* City */}
      <select
        value={city}
        onChange={(e) => {
          setCity(e.target.value);
          push({ city: e.target.value });
        }}
        aria-label="City"
        className={`${selectCls} sm:w-auto sm:min-w-[160px]`}
      >
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c.city} value={c.city}>
            {c.city} ({c.count})
          </option>
        ))}
      </select>

      {/* Min price */}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={minPrice}
        onChange={(e) => setMinPrice(e.target.value)}
        placeholder="Min ₹"
        aria-label="Minimum price per night"
        className={`${inputCls} sm:w-28`}
      />

      {/* Max price */}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
        placeholder="Max ₹"
        aria-label="Maximum price per night"
        className={`${inputCls} sm:w-28`}
      />

      {/* Min rating */}
      <select
        value={minRating}
        onChange={(e) => {
          setMinRating(e.target.value);
          push({ minRating: e.target.value });
        }}
        aria-label="Minimum rating"
        className={`${selectCls} sm:w-auto`}
      >
        <option value="">Any rating</option>
        <option value="3">3+</option>
        <option value="3.5">3.5+</option>
        <option value="4">4+</option>
        <option value="4.5">4.5+</option>
      </select>

      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => {
          setSort(e.target.value);
          push({ sort: e.target.value });
        }}
        aria-label="Sort"
        className={`${selectCls} sm:w-auto`}
      >
        <option value="">Popular</option>
        <option value="price">Price ↑</option>
        <option value="-price">Price ↓</option>
        <option value="rating">Rating</option>
      </select>

      {/* Apply */}
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.03] active:scale-95"
      >
        Apply
      </button>

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
        >
          <X className="h-4 w-4" /> Clear
        </button>
      )}
    </form>
  );
}
