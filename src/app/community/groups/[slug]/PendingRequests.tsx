"use client";

import { useState, useTransition } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { approveJoinRequest, rejectJoinRequest } from "@/lib/actions/communities";
import type { PendingRequestRow } from "@/lib/queries/communities";

// Owner-only approve/reject panel, shown on the group's own page. Mirrors the
// same optimistic-remove-from-list pattern used for "mark all read" in
// NotificationsList.tsx.
export function PendingRequests({
  communityId,
  initialRequests,
}: {
  communityId: string;
  initialRequests: PendingRequestRow[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function approve(userId: string) {
    setBusyId(userId);
    startTransition(async () => {
      const res = await approveJoinRequest(communityId, userId);
      if (res.ok) setRequests((r) => r.filter((x) => x.userId !== userId));
      setBusyId(null);
    });
  }

  function reject(userId: string) {
    setBusyId(userId);
    startTransition(async () => {
      const res = await rejectJoinRequest(communityId, userId);
      if (res.ok) setRequests((r) => r.filter((x) => x.userId !== userId));
      setBusyId(null);
    });
  }

  if (requests.length === 0) return null;

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-bold text-[color:var(--text)]">
        Pending join requests ({requests.length})
      </h2>
      <ul className="space-y-2">
        {requests.map((r) => {
          const busy = isPending && busyId === r.userId;
          return (
            <li key={r.userId} className="flex items-center gap-3">
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {r.name.charAt(0).toUpperCase()}
                </span>
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text)]">{r.name}</p>
              <button
                type="button"
                onClick={() => approve(r.userId)}
                disabled={busy}
                aria-label="Approve"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 active:scale-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => reject(r.userId)}
                disabled={busy}
                aria-label="Reject"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100 active:scale-90 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
