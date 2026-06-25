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
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}
