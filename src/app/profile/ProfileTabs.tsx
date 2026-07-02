"use client";

import { useState, type ReactNode } from "react";
import { Grid3x3, Briefcase, Heart } from "lucide-react";

type TabKey = "posts" | "trips" | "saved";

interface ProfileTabsProps {
  counts: { posts: number; trips: number; saved: number };
  posts: ReactNode;
  trips: ReactNode;
  saved: ReactNode;
}

export function ProfileTabs({ counts, posts, trips, saved }: ProfileTabsProps) {
  const [tab, setTab] = useState<TabKey>("posts");

  const tabs: { key: TabKey; label: string; icon: ReactNode; count: number }[] = [
    { key: "posts", label: "Posts", icon: <Grid3x3 className="h-4 w-4" />, count: counts.posts },
    { key: "trips", label: "Trips", icon: <Briefcase className="h-4 w-4" />, count: counts.trips },
    { key: "saved", label: "Saved", icon: <Heart className="h-4 w-4" />, count: counts.saved },
  ];

  return (
    <section className="mt-8">
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-bold transition active:scale-95 ${
                active
                  ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-md shadow-emerald-500/30"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="animate-fadeUp">
        {tab === "posts" && posts}
        {tab === "trips" && trips}
        {tab === "saved" && saved}
      </div>
    </section>
  );
}
