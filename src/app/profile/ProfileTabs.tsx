"use client";

import { useState, type ReactNode } from "react";
import { Grid3x3, Briefcase, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TabKey = "posts" | "trips" | "saved";

interface ProfileTabsProps {
  counts: { posts: number; trips: number; saved: number };
  posts: ReactNode;
  trips: ReactNode;
  saved: ReactNode;
}

export function ProfileTabs({ counts, posts, trips, saved }: ProfileTabsProps) {
  const [tab, setTab] = useState<TabKey>("posts");

  // `count: null` hides the number bubble (Trips mixes DB plans + locally-saved
  // budget trips, so a server count would be misleading).
  const tabs: { key: TabKey; label: string; icon: ReactNode; count: number | null }[] = [
    { key: "posts", label: "Posts", icon: <Grid3x3 className="h-4 w-4" />, count: counts.posts },
    { key: "trips", label: "Trips", icon: <Briefcase className="h-4 w-4" />, count: null },
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
              className={`relative flex min-h-[44px] items-center justify-center gap-1.5 overflow-hidden rounded-xl px-2 py-2 text-sm font-bold transition active:scale-95 ${
                active ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="profile-tab-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 shadow-md shadow-emerald-500/30"
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
                {t.count !== null && (
                  <span
                    className={`rounded-full px-1.5 text-xs ${
                      active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === "posts" && posts}
          {tab === "trips" && trips}
          {tab === "saved" && saved}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
