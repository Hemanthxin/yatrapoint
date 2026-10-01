"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Goes back to wherever the user came from (e.g. the Budget Planner) instead of
// always returning to Explore. Falls back to a given href if there's no history.
export function BackButton({ fallback = "/explore-bangalore", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      onClick={goBack}
      aria-label={label}
      className="mb-4 inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/90 pl-2.5 pr-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:scale-[1.02] hover:border-emerald-200 hover:text-emerald-700 active:scale-95"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-600">
        <ArrowLeft className="h-4 w-4" />
      </span>
      {label}
    </button>
  );
}
