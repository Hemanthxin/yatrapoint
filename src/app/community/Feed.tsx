"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Flame, User2, Plus, Rows3, Grid3x3, ArrowUp, LayoutGrid, BookOpen, Lightbulb, HelpCircle, Image as ImageIcon, CalendarDays } from "lucide-react";

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

type PostType = "story" | "tip" | "question" | "photo" | "event";

const POST_TYPE_FILTERS: { id: PostType | "all"; label: string; icon: typeof LayoutGrid }[] = [
  { id: "all", label: "All Posts", icon: LayoutGrid },
  { id: "story", label: "Trip Stories", icon: BookOpen },
  { id: "tip", label: "Travel Tips", icon: Lightbulb },
  { id: "question", label: "Questions", icon: HelpCircle },
  { id: "photo", label: "Photos", icon: ImageIcon },
  { id: "event", label: "Events", icon: CalendarDays },
];

export function Feed({
  posts: initialPosts,
  social: initialSocial,
  media: initialMedia,
  currentUserId,
  userName,
  userImage,
  communityId,
  authorTiers,
}: {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  media?: Record<string, MediaItem[]>;
  currentUserId: string;
  userName: string;
  userImage?: string | null;
  communityId?: string;
  /** userId -> contributor-tier badge label, e.g. "Top Contributor". */
  authorTiers?: Record<string, string>;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [social, setSocial] = useState(initialSocial);
  const [media, setMedia] = useState<Record<string, MediaItem[]>>(initialMedia ?? {});
  const [pendingPosts, setPendingPosts] = useState<CommunityPost[]>([]);
  const [tab, setTab] = useState<Tab>("latest");
  const [typeFilter, setTypeFilter] = useState<PostType | "all">("all");
  const [view, setView] = useState<"feed" | "grid">("feed");
  const [composerOpen, setComposerOpen] = useState(false);
  const feedTopRef = useRef<HTMLDivElement>(null);

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
        const result = await refreshFeed(knownIds, 40, communityId);
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
  }, [posts, pendingPosts, currentUserId, communityId]);

  // Lets a CTA outside this component's tree (e.g. the right-rail "Share
  // Your Journey" card, which is server-rendered by page.tsx) open the
  // composer without prop-drilling through the server component.
  useEffect(() => {
    function open() {
      setComposerOpen(true);
      feedTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.addEventListener("yatra:open-composer", open);
    return () => window.removeEventListener("yatra:open-composer", open);
  }, []);

  function showPendingPosts() {
    setPosts((prev) => [...pendingPosts, ...prev]);
    setPendingPosts([]);
    feedTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const visible = useMemo(() => {
    let list = posts;
    if (tab === "mine") list = list.filter((p) => p.userId === currentUserId);
    if (typeFilter !== "all") list = list.filter((p) => p.postType === typeFilter);
    if (tab === "popular") list = [...list].sort((a, b) => socialOf(b.id).total - socialOf(a.id).total);
    return list; // latest = given order
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, tab, typeFilter, currentUserId, social]);

  const mineCount = useMemo(
    () => posts.filter((p) => p.userId === currentUserId).length,
    [posts, currentUserId]
  );

  const emptyCopy: Record<Tab, { title: string; text: string }> = {
    latest: { title: "No posts yet", text: "Be the first to share a place!" },
    popular: { title: "Nothing trending yet", text: "React to posts to heat them up." },
    mine: { title: "You haven't posted yet", text: "Share your first place above!" },
  };

  // The reading feed is a single centred column (Instagram-style): at 3 columns
  // each card was ~260px wide, which squeezed captions into tall ragged walls of
  // text. The dense square Explore grid still wants the full width.
  const shell = view === "grid" ? "max-w-5xl" : "max-w-2xl";

  return (
    <div className={`mx-auto ${shell} space-y-5`}>
      <div ref={feedTopRef} className="w-full space-y-5">
        {/* Stories — recent posters, tap for a full-screen story viewer */}
        <Stories
          posts={posts}
          social={social}
          currentUserId={currentUserId}
          onOpenComposer={() => setComposerOpen(true)}
        />

        {/* Composer — expands here when opened from "Add post" in the tabs bar below */}
        {composerOpen && (
          <CommunityForm
            onPosted={() => setComposerOpen(false)}
            onCancel={() => setComposerOpen(false)}
            communityId={communityId}
          />
        )}
      </div>

      {/* Content-type filter — All Posts / Trip Stories / Travel Tips / Questions / Photos / Events */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {POST_TYPE_FILTERS.map((t) => {
          const Icon = t.icon;
          const active = typeFilter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTypeFilter(t.id)}
              aria-pressed={active}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold tracking-tight transition active:scale-95 ${
                active
                  ? "border-transparent bg-emerald-600 text-white"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Pill tabs + feed/grid view toggle */}
      <div className="card sticky top-2 z-10 flex items-center gap-1.5 p-1">
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
                <span className="hidden truncate sm:inline">{t.label}</span>
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

        <div className="flex shrink-0 border-l border-[color:var(--border)] pl-1.5">
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="btn-primary h-9 shrink-0 gap-1.5 rounded-xl px-3 text-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add post</span>
          </button>
        </div>
      </div>

      {/* Live "new posts" banner — real-time without yanking the feed around */}
      {tab === "latest" && pendingPosts.length > 0 && (
        <div className="flex justify-center">
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
        <RevealGrid className="grid grid-cols-1 gap-5">
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
              tier={authorTiers?.[p.userId]}
            />
          ))}
        </RevealGrid>
      )}
    </div>
  );
}
