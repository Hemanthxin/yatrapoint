"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, UserPlus, Clock, Crown } from "lucide-react";
import { requestToJoin } from "@/lib/actions/communities";

export type MembershipStatus = "none" | "pending" | "approved" | "owner";

// Directory-card / group-header "Join" control. Deliberately doesn't offer
// "Leave" here — that lives on the group page itself (LeaveButton) so a
// dense list of cards doesn't risk an accidental leave click.
export function JoinButton({
  communityId,
  initialStatus,
  className = "",
}: {
  communityId: string;
  initialStatus: MembershipStatus;
  className?: string;
}) {
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

  if (status === "owner")
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 ${className}`}>
        <Crown className="h-3.5 w-3.5" /> Owner
      </span>
    );
  if (status === "approved")
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ${className}`}>
        <Check className="h-3.5 w-3.5" /> Member
      </span>
    );
  if (status === "pending")
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 ${className}`}>
        <Clock className="h-3.5 w-3.5" /> Requested
      </span>
    );

  return (
    <div className={className}>
      <button
        type="button"
        onClick={join}
        disabled={isPending}
        className="btn-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        Join
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
