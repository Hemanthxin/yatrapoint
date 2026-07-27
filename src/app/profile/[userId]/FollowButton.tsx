"use client";

import { useState, useTransition } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { toggleFollow } from "@/lib/actions/follows";

export function FollowButton({
  targetUserId,
  initialFollowing,
  onCountChange,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  onCountChange?: (followerCount: number) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const prev = following;
    setFollowing(!prev); // optimistic
    startTransition(async () => {
      const res = await toggleFollow(targetUserId);
      if (!res.ok) {
        setFollowing(prev); // revert
        return;
      }
      setFollowing(!!res.following);
      if (res.followerCount != null) onCountChange?.(res.followerCount);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-6 text-sm font-bold shadow-md transition active:scale-95 disabled:opacity-70 ${
        following
          ? "border border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50"
          : "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-500/30 hover:scale-[1.03]"
      }`}
    >
      {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
