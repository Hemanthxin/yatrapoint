"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteGroupTrip } from "@/lib/actions/group-trips";
import { removeFromCart } from "@/lib/cart";

export function DeleteTripButton({
  tripId,
  joinCode,
  name,
  redirectTo,
}: {
  tripId: string;
  joinCode: string;
  name: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!window.confirm(`Delete "${name}"? This removes the trip for everyone and can't be undone.`)) return;
    setError(null);
    start(async () => {
      const res = await deleteGroupTrip(tripId);
      if (!res.ok) return setError(res.error ?? "Could not delete the trip.");
      removeFromCart(`group-${joinCode}`);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="mt-1 text-[11px] font-semibold text-red-600">{error}</span>}
    </span>
  );
}
