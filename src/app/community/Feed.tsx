"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Flame, User2, Plus, Rows3, Grid3x3, ArrowUp } from "lucide-react";

import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { refreshFeed } from "@/lib/actions/community";
import { CommunityForm } from "./CommunityForm";
import { PostCard } from "./PostCard";
import { Stories } from "./Stories";
import { ExploreGrid } from "./ExploreGrid";
import type { MediaItem } from "./MediaCarousel";
import { RevealGrid } from "@/components/app/RevealGrid";
import { EmptyState } from "@/components/app/EmptyState";
import { CommunityIllustration } from "@/components/illustrations";

// Local default — NOT imported from "@/lib/queries/community" because that module
// pulls in the server DB client, which would crash when bundled into this
// "use client" component.
function emptySocial(): PostSocial {
  return { counts: { love: 0, wantToGo: 0, beenThere: 0 }, total: 0, comments: 0, mine: null };
}

const POLL_MS = 8000;

type Tab = "latest" | "popular" | "mine";

const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "latest", label: "Latest", icon: Sparkles },
  { id: "popular", label: "Popular", icon: Flame },
  { id: "mine", label: "Mine", icon: User2 },
];

export function Feed({
  posts: initialPosts,
  social: initialSocial,
  media: initialMedia,
  currentUserId,
  userName,
  userImage,
}: {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  media?: Record<string, MediaItem[]>;
  currentUserId: string;
  userName: string;
  userImage?: string | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [social, setSocial] = useState(initialSocial);
  const [media, setMedia] = useState<Record<string, MediaItem[]>>(initialMedia ?? {});
  const [pendingPosts, setPendingPosts] = useState<CommunityPost[]>([]);
  const [tab, setTab] = useState<Tab>("latest");
  const [view, setView] = useState<"feed" | "grid">("feed");
  const [composerOpen, setComposerOpen] = useState(false);
  const feedTopRef = useRef<HTMLDivElement>(null);

  const initial = (userName?.trim()?.[0] ?? "?").toUpperCase();

  function handleDeleted(postId: string) {
    setPosts((p) => p.filter((x) => x.id !== postId));
  }

  const socialOf = (id: string) => social[id] ?? emptySocial();

  // Live feed — poll for new posts + fresh reaction/comment counts every few
  // seconds. New posts don't get spliced straight in (that would yank the
  // feed out from under someone mid-scroll); they queue behind a "N new
  // posts" banner, Twitter/Instagram-style, until tapped.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const knownIds = [...posts.map((p) => p.id), ...pendingPosts.map((p) => p.id)];
        const result = await refreshFeed(knownIds);
        setSocial((prev) => ({ ...prev, ...result.social }));
        if (Object.keys(result.media).length > 0) {
          setMedia((prev) => {
            const next = { ...prev };
            for (const [postId, items] of Object.entries(result.media)) {
              next[postId] = items.map((m) => ({ url: m.url, kind: m.kind === "video" ? "video" : "image" }));
            }
            return next;
          });
        }
        if (result.newPosts.length > 0) {
          setPendingPosts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const fresh = result.newPosts.filter((p) => !seen.has(p.id) && p.userId !== currentUserId);
            return fresh.length > 0 ? [...fresh, ...prev] : prev;
          });
        }
      } catch {
        // transient network hiccup — try again next tick
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, pendingPosts, currentUserId]);

  function showPendingPosts() {
    setPosts((prev) => [...pendingPosts, ...prev]);
    setPendingPosts([]);
    feedTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    <div className="mx-auto max-w-6xl space-y-6">
      <div ref={feedTopRef} className="mx-auto w-full max-w-2xl space-y-6">
        {/* Stories — recent posters, tap for a full-screen story viewer */}
        <Stories
          posts={posts}
          social={social}
          currentUserId={currentUserId}
          onOpenComposer={() => setComposerOpen(true)}
        />

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
            className="card card-hover flex w-full items-center gap-3 p-3 text-left"
          >
            {userImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={userImage}
                alt={userName}
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--border)]"
              />
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                {initial}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate rounded-full bg-[color:var(--surface-2)] px-4 py-2.5 text-sm font-medium text-[color:var(--muted)]">
              Share a place, tip or hidden gem…
            </span>
            <span className="btn-primary min-h-[44px] shrink-0 rounded-xl px-4 text-sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add post</span>
            </span>
          </button>
        )}
      </div>

      {/* Pill tabs + feed/grid view toggle */}
      <div className="card sticky top-2 z-10 mx-auto flex max-w-6xl items-center gap-1.5 p-1">
        <div className="flex flex-1 gap-1">
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
                    ? "bg-emerald-600 text-white"
                    : "text-[color:var(--muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.label}</span>
                {t.id === "mine" && mineCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-xs ${
                      active ? "bg-white/25 text-white" : "bg-[color:var(--surface-2)] text-[color:var(--muted)]"
                    }`}
                  >
                    {mineCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 gap-0.5 border-l border-[color:var(--border)] pl-1.5">
          <button
            type="button"
            onClick={() => setView("feed")}
            aria-label="Side-by-side view"
            aria-pressed={view === "feed"}
            className={`grid h-9 w-9 place-items-center rounded-xl transition active:scale-95 ${
              view === "feed" ? "bg-[color:var(--text)] text-[color:var(--surface)]" : "text-[color:var(--muted)] hover:bg-[color:var(--surface-2)]"
            }`}
          >
            <Rows3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={`grid h-9 w-9 place-items-center rounded-xl transition active:scale-95 ${
              view === "grid" ? "bg-[color:var(--text)] text-[color:var(--surface)]" : "text-[color:var(--muted)] hover:bg-[color:var(--surface-2)]"
            }`}
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Live "new posts" banner — real-time without yanking the feed around */}
      {tab === "latest" && pendingPosts.length > 0 && (
        <div className="mx-auto flex max-w-6xl justify-center">
          <button
            type="button"
            onClick={showPendingPosts}
            className="btn-primary sticky top-16 z-10 px-5 py-2.5 text-sm"
          >
            <ArrowUp className="h-4 w-4" />
            {pendingPosts.length} new {pendingPosts.length === 1 ? "post" : "posts"}
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          illustration={CommunityIllustration}
          title={emptyCopy[tab].title}
          description={emptyCopy[tab].text}
        />
      ) : view === "grid" ? (
        <ExploreGrid
          posts={visible}
          social={social}
          currentUserId={currentUserId}
          userName={userName}
          userImage={userImage}
          onDeleted={handleDeleted}
          mediaByPost={media}
        />
      ) : (
        <RevealGrid className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              social={socialOf(p.id)}
              userName={userName}
              userImage={userImage}
              currentUserId={currentUserId}
              index={i}
              onDeleted={handleDeleted}
              media={media[p.id]}
            />
          ))}
        </RevealGrid>
      )}
    </div>
  );
}
