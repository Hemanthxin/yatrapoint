"use client";

import { useMemo, useState } from "react";
import { Sparkles, Flame, User2, Plus } from "lucide-react";

import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { CommunityForm } from "./CommunityForm";
import { PostCard } from "./PostCard";
import { EmptyState } from "@/components/app/EmptyState";
import { CommunityIllustration } from "@/components/illustrations";

// Local default — NOT imported from "@/lib/queries/community" because that module
// pulls in the server DB client, which would crash when bundled into this
// "use client" component.
function emptySocial(): PostSocial {
  return { counts: { love: 0, wantToGo: 0, beenThere: 0 }, total: 0, comments: 0, mine: null };
}

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
  const [composerOpen, setComposerOpen] = useState(false);

  const initial = (userName?.trim()?.[0] ?? "?").toUpperCase();

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

  const emptyCopy: Record<Tab, { title: string; text: string }> = {
    latest: { title: "No posts yet", text: "Be the first to share a place!" },
    popular: { title: "Nothing trending yet", text: "React to posts to heat them up." },
    mine: { title: "You haven't posted yet", text: "Share your first place above!" },
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Composer: compact trigger bar → expands into full form */}
      {composerOpen ? (
        <CommunityForm
          onPosted={() => setComposerOpen(false)}
          onCancel={() => setComposerOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="card-hover flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 text-left shadow-sm"
        >
          {userImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={userImage}
              alt={userName}
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-emerald-500/20"
            />
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-sm font-bold text-white shadow-md shadow-emerald-500/30">
              {initial}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate rounded-full bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500">
            Share a place, tip or hidden gem…
          </span>
          <span className="relative inline-flex min-h-[44px] shrink-0 items-center gap-1.5 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95">
            <span aria-hidden className="sheen-overlay animate-sheen" />
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add post</span>
          </span>
        </button>
      )}

      {/* Pill tabs */}
      <div className="sticky top-2 z-10 flex gap-1 rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={active}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold tracking-tight transition active:scale-95 ${
                active
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.label}</span>
              {t.id === "mine" && mineCount > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
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
        <EmptyState
          illustration={CommunityIllustration}
          title={emptyCopy[tab].title}
          description={emptyCopy[tab].text}
        />
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
