"use client";

import { useMemo, useState } from "react";
import { Sparkles, Flame, User2 } from "lucide-react";

import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { emptySocial } from "@/lib/queries/community";
import { CommunityForm } from "./CommunityForm";
import { PostCard } from "./PostCard";

type Tab = "latest" | "popular" | "mine";

const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "latest", label: "Latest", icon: Sparkles },
  { id: "popular", label: "Popular", icon: Flame },
  { id: "mine", label: "Mine", icon: User2 },
];

export function Feed({
  posts: initialPosts,
  social,
  currentUserId,
  userName,
  userImage,
}: {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  currentUserId: string;
  userName: string;
  userImage?: string | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [tab, setTab] = useState<Tab>("latest");

  function handleDeleted(postId: string) {
    setPosts((p) => p.filter((x) => x.id !== postId));
  }

  const socialOf = (id: string) => social[id] ?? emptySocial();

  const visible = useMemo(() => {
    if (tab === "mine") return posts.filter((p) => p.userId === currentUserId);
    if (tab === "popular")
      return [...posts].sort((a, b) => socialOf(b.id).total - socialOf(a.id).total);
    return posts; // latest = given order
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, tab, currentUserId, social]);

  const mineCount = useMemo(
    () => posts.filter((p) => p.userId === currentUserId).length,
    [posts, currentUserId]
  );

  const emptyCopy: Record<Tab, { emoji: string; text: string }> = {
    latest: { emoji: "📸", text: "No posts yet — be the first to share a place!" },
    popular: { emoji: "🔥", text: "Nothing trending yet — react to posts to heat them up." },
    mine: { emoji: "🧳", text: "You haven't posted yet — share your first place above!" },
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CommunityForm />

      {/* Pill tabs */}
      <div className="sticky top-2 z-10 flex gap-1.5 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={active}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold tracking-tight transition active:scale-95 ${
                active
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.label}</span>
              {t.id === "mine" && mineCount > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    active ? "bg-white/25" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {mineCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="animate-fadeUp rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-3xl">{emptyCopy[tab].emoji}</p>
          <p className="mt-2 text-sm text-slate-500">{emptyCopy[tab].text}</p>
        </div>
      ) : (
        visible.map((p, i) => (
          <PostCard
            key={p.id}
            post={p}
            social={socialOf(p.id)}
            userName={userName}
            userImage={userImage}
            currentUserId={currentUserId}
            index={i}
            onDeleted={handleDeleted}
          />
        ))
      )}
    </div>
  );
}
