"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useEffect } from "react";
import { X, Heart, MessageCircle, Copy, Play } from "lucide-react";
import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { PostCard } from "./PostCard";
import type { MediaItem } from "./MediaCarousel";

// Instagram-style Explore: a dense 3-column square grid of every post. Tapping
// a tile opens the same PostCard (with all its reaction/comment logic) in a
// full-screen sheet instead of duplicating that behaviour here.
export function ExploreGrid({
  posts,
  social,
  currentUserId,
  userName,
  userImage,
  onDeleted,
  mediaByPost,
}: {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  currentUserId: string;
  userName: string;
  userImage?: string | null;
  onDeleted?: (postId: string) => void;
  mediaByPost?: Record<string, MediaItem[]>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = posts.findIndex((p) => p.id === activeId);
  const active = activeIndex >= 0 ? posts[activeIndex] : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {posts.map((post) => {
          const s = social[post.id] ?? { counts: { love: 0, wantToGo: 0, beenThere: 0 }, total: 0, comments: 0, mine: null };
          const media = mediaByPost?.[post.id];
          const isVideo = media?.[0]?.kind === "video";
          const isCarousel = !!media && media.length > 1;
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => setActiveId(post.id)}
              className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-slate-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
            >
              {post.photoUrl ? (
                isVideo ? (
                  <video src={post.photoUrl} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.photoUrl}
                    alt={post.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-emerald-700 p-2 text-center">
                  <span className="line-clamp-3 text-xs font-bold text-white">{post.title}</span>
                </div>
              )}
              {(isVideo || isCarousel) && (
                <span className="absolute right-2 top-2 text-white drop-shadow">
                  {isVideo ? <Play className="h-4 w-4 fill-white" /> : <Copy className="h-4 w-4" />}
                </span>
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/40 text-sm font-bold text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                <span className="inline-flex items-center gap-1.5">
                  <Heart className="h-4 w-4 fill-white" /> {s.counts.love}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4 fill-white" /> {s.comments}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <PostSheet onClose={() => setActiveId(null)}>
          <PostCard
            post={active}
            social={social[active.id] ?? { counts: { love: 0, wantToGo: 0, beenThere: 0 }, total: 0, comments: 0, mine: null }}
            userName={userName}
            userImage={userImage}
            currentUserId={currentUserId}
            index={0}
            media={mediaByPost?.[active.id]}
            onDeleted={(id) => {
              onDeleted?.(id);
              setActiveId(null);
            }}
          />
        </PostSheet>
      )}
    </>
  );
}

function PostSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-11 right-1 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-90 sm:-right-11 sm:top-0"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
