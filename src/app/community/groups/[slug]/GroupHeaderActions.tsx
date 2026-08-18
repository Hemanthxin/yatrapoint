"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Clock, Crown, LogOut } from "lucide-react";
import { requestToJoin, leaveCommunity } from "@/lib/actions/communities";
import type { MembershipStatus } from "../JoinButton";

// The group page's own Join/Leave control — unlike the directory's
// JoinButton, an approved (non-owner) member can leave from here.
export function GroupHeaderActions({
  communityId,
  initialStatus,
}: {
  communityId: string;
  initialStatus: MembershipStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<MembershipStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function join() {
    setError(null);
    startTransition(async () => {
      const res = await requestToJoin(communityId);
      if (!res.ok) return setError(res.error || "Could not send request.");
      setStatus(res.status === "approved" ? "approved" : "pending");
    });
  }

  function leave() {
    if (!confirm("Leave this community?")) return;
    setError(null);
    startTransition(async () => {
      const res = await leaveCommunity(communityId);
      if (!res.ok) return setError(res.error || "Could not leave.");
      setStatus("none");
      router.refresh();
    });
  }

  if (status === "owner")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
        <Crown className="h-4 w-4" /> You created this
      </span>
    );

  if (status === "approved")
    return (
      <div>
        <button
          type="button"
          onClick={leave}
          disabled={isPending}
          className="btn-secondary rounded-full px-4 py-2 text-sm disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Leave
        </button>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
    );

  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500">
        <Clock className="h-4 w-4" /> Requested — waiting for approval
      </span>
    );

  return (
    <div>
      <button
        type="button"
        onClick={join}
        disabled={isPending}
        className="btn-primary rounded-full px-5 py-2.5 text-sm disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Join community
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
