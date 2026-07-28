"use client";

import { useMemo, useState } from "react";
import { Grid3x3, Film } from "lucide-react";
import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import type { MediaItem } from "@/app/community/MediaCarousel";
import { ExploreGrid } from "@/app/community/ExploreGrid";
import { EmptyState } from "@/components/app/EmptyState";
import { CommunityIllustration } from "@/components/illustrations";

// Instagram-style "Posts" / "Reels" tab strip above a profile's grid. Reels is
// just a CLIENT-SIDE filter over the same posts+media already loaded (a post
// qualifies when its first media item is a video) — no extra query needed.
export function ProfilePostsSection({
  posts,
  social,
  media,
  currentUserId,
  userName,
  userImage,
  displayName,
}: {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  media: Record<string, MediaItem[]>;
  currentUserId: string;
  userName: string;
  userImage?: string | null;
  displayName: string;
}) {
  const reelIds = useMemo(
    () => new Set(posts.filter((p) => media[p.id]?.[0]?.kind === "video").map((p) => p.id)),
    [posts, media]
  );
  const hasReels = reelIds.size > 0;
  const [tab, setTab] = useState<"posts" | "reels">("posts");

  const visible = tab === "reels" ? posts.filter((p) => reelIds.has(p.id)) : posts;

  return (
    <div>
      <div className="flex">
        <TabButton active={tab === "posts"} onClick={() => setTab("posts")} icon={Grid3x3} label="Posts" />
        {hasReels && <TabButton active={tab === "reels"} onClick={() => setTab("reels")} icon={Film} label="Reels" />}
      </div>

      <div className="mt-4">
        {visible.length === 0 ? (
          <EmptyState
            illustration={CommunityIllustration}
            title={tab === "reels" ? "No reels yet" : "No posts yet"}
            description={
              tab === "reels"
                ? `${displayName} hasn't shared any video posts yet.`
                : `${displayName} hasn't shared any places yet.`
            }
          />
        ) : (
          <ExploreGrid
            posts={visible}
            social={social}
            currentUserId={currentUserId}
            userName={userName}
            userImage={userImage}
            mediaByPost={media}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Grid3x3;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 border-t-2 py-3 text-xs font-bold uppercase tracking-wide transition ${
        active
          ? "border-[color:var(--text)] text-[color:var(--text)]"
          : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--text-soft)]"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
