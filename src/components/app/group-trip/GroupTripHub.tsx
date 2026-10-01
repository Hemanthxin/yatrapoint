"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, MapPinPlus, Vote as VoteIcon, ClipboardCheck, Route, Copy } from "lucide-react";

import type { GroupTrip } from "@/lib/db/schema";
import type { GroupTripMemberRow, SuggestionWithVotes } from "@/lib/queries/group-trips";
import type { GeneratedItinerary } from "@/lib/itinerary";
import type { Destination } from "@/lib/db/schema";
import { showToast } from "@/lib/toast";
import { MembersTab } from "./MembersTab";
import { AddPlacesTab } from "./AddPlacesTab";
import { VoteTab } from "./VoteTab";
import { ItineraryTab } from "./ItineraryTab";

type TabId = "members" | "add" | "vote" | "decide" | "itinerary";

export function GroupTripHub({
  trip,
  currentUserId,
  role,
  members,
  suggestions,
  itinerary,
  popularPlaces,
}: {
  trip: GroupTrip;
  currentUserId: string;
  role: "admin" | "member";
  members: GroupTripMemberRow[];
  suggestions: SuggestionWithVotes[];
  itinerary: GeneratedItinerary | null;
  popularPlaces: Destination[];
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const [tab, setTab] = useState<TabId>(itinerary ? "itinerary" : "members");

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: "members", label: "Members", icon: Users },
    { id: "add", label: "Add Places", icon: MapPinPlus },
    { id: "vote", label: "Vote", icon: VoteIcon },
    ...(isAdmin ? [{ id: "decide" as TabId, label: "Decide", icon: ClipboardCheck }] : []),
    { id: "itinerary", label: "Itinerary", icon: Route },
  ];

  function refresh() {
    router.refresh();
  }

  async function copyJoinCode() {
    try {
      await navigator.clipboard.writeText(trip.joinCode);
      showToast("Invite code copied", "🔗");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{trip.name}</h1>
          <p className="text-xs text-slate-500">
            {trip.startLabel} → {trip.destinationLabel} · {trip.days} day{trip.days > 1 ? "s" : ""} · {members.length}/{trip.travellers} joined
          </p>
        </div>
        <button
          type="button"
          onClick={copyJoinCode}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
        >
          <Copy className="h-3.5 w-3.5" /> {trip.joinCode}
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition ${
                active ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-emerald-600" : "text-slate-400"}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "members" && <MembersTab trip={trip} members={members} isAdmin={isAdmin} onChange={refresh} />}
      {tab === "add" && <AddPlacesTab tripId={trip.id} popularPlaces={popularPlaces} suggestedPlaceIds={suggestions.map((s) => s.place.id)} onChange={refresh} />}
      {tab === "vote" && <VoteTab suggestions={suggestions} isAdmin={false} onChange={refresh} />}
      {tab === "decide" && isAdmin && (
        <VoteTab suggestions={suggestions} isAdmin tripId={trip.id} confirmedCount={suggestions.filter((s) => s.status === "confirmed").length} onChange={refresh} />
      )}
      {tab === "itinerary" && <ItineraryTab trip={trip} itinerary={itinerary} isAdmin={isAdmin} onChange={refresh} />}
    </div>
  );
}
