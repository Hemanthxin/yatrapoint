"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, UserPlus, LogOut } from "lucide-react";

import type { GroupTrip } from "@/lib/db/schema";
import type { GroupTripMemberRow } from "@/lib/queries/group-trips";
import { leaveGroupTrip } from "@/lib/actions/group-trips";
import { showToast } from "@/lib/toast";

export function MembersTab({
  trip,
  members,
  isAdmin,
  onChange,
}: {
  trip: GroupTrip;
  members: GroupTripMemberRow[];
  isAdmin: boolean;
  onChange: () => void;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    setLeaving(true);
    const res = await leaveGroupTrip(trip.id);
    setLeaving(false);
    if (!res.ok) {
      showToast(res.error ?? "Could not leave the trip", "⚠️");
      return;
    }
    showToast("You left the trip", "👋");
    router.push("/group-trip");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-slate-900">
          Trip Members ({members.length}/{trip.travellers})
        </p>
        <Link
          href={`/group-trip/${trip.joinCode}/invite`}
          className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
        >
          <UserPlus className="h-3.5 w-3.5" /> Invite
        </Link>
      </div>

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.userId} className="card flex items-center gap-3 p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image} alt="" className="h-full w-full object-cover" />
              ) : (
                (m.name || "?").charAt(0).toUpperCase()
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{m.name || "Traveller"}</span>
            {m.role === "admin" ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                <Crown className="h-3 w-3" /> Admin
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Joined</span>
            )}
          </div>
        ))}
      </div>

      {!isAdmin && (
        <button
          type="button"
          onClick={leave}
          disabled={leaving}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-red-200 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" /> {leaving ? "Leaving…" : "Leave trip"}
        </button>
      )}
    </div>
  );
}
