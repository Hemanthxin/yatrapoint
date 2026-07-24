"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import type { TripHistoryRow } from "@/lib/db/schema";
import { clearTripHistory, deleteTripHistoryItem } from "@/lib/actions/long-trips";

function hrefFor(item: TripHistoryRow): string | null {
  if (item.kind === "long-trip" && item.refSlug) {
    // The state segment isn't stored on the history row, so resolve it via a
    // redirect-friendly lookup route instead of guessing the state slug.
    return `/trip-history/open/${item.refSlug}`;
  }
  return null;
}

export function HistoryList({ items }: { items: TripHistoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingClear, setConfirmingClear] = useState(false);

  function onOpen(item: TripHistoryRow) {
    const href = hrefFor(item);
    if (href) router.push(href);
  }

  function onDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await deleteTripHistoryItem(id);
      router.refresh();
    });
  }

  function onClearAll() {
    startTransition(async () => {
      await clearTripHistory();
      setConfirmingClear(false);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-slate-600">No trip history yet</p>
        <p className="mt-1 text-xs text-slate-400">
          Plans you open or generate will show up here so you can find them again.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex justify-end">
        {confirmingClear ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Clear all history?</span>
            <button
              type="button"
              onClick={onClearAll}
              disabled={pending}
              className="rounded-xl bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700"
            >
              Yes, clear
            </button>
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            className="text-sm font-semibold text-rose-600 hover:text-rose-700"
          >
            Clear history
          </button>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            onClick={() => onOpen(item)}
            className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {item.kind === "long-trip" ? "Long trip" : "Budget plan"} ·{" "}
                {new Date(item.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => onDelete(item.id, e)}
              aria-label="Remove from history"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
