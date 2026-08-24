import Link from "next/link";
import { Users } from "lucide-react";
import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial, PostMediaItem } from "@/lib/queries/community";
import type { CommunitySummary } from "@/lib/queries/communities";
import { Feed } from "./Feed";
import { CommunityTopBar } from "./CommunityTopBar";
import { ReelsEntry } from "./ReelsEntry";

interface Props {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  media?: Record<string, PostMediaItem[]>;
  currentUserId: string;
  userName: string;
  userImage?: string | null;
  authorTiers?: Record<string, string>;
  trending?: CommunitySummary[];
}

// A bespoke, app-first mobile Community — rendered only below `lg`. It frames the
// SAME <Feed/> (composer + tabs + posts, all logic preserved) with a slim,
// Instagram-style app-bar (wordmark + icon nav, no big banner), so nothing
// about the feed's reaction / comment / edit / delete behaviour is duplicated.
export function MobileCommunity({ posts, social, media, currentUserId, userName, userImage, authorTiers, trending }: Props) {
  return (
    <div className="space-y-4 pb-4">
      <header className="sticky top-2 z-10 flex items-center justify-between gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-extrabold tracking-tight text-[color:var(--text)]">Community</h1>
        <CommunityTopBar />
      </header>

      {/* Named, tappable way into Reels — the top-bar icon alone wasn't
          discoverable (BUG-11). */}
      <ReelsEntry />

      {/* Compact desktop-rail equivalent: a horizontally-scrollable strip of
          trending communities, since the mockup this mirrors is itself a
          mobile screenshot. */}
      {trending && trending.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {trending.map((c) => (
            <Link
              key={c.id}
              href={`/community/groups/${c.slug}`}
              className="card flex shrink-0 items-center gap-2 px-3 py-2"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-emerald-100">
                {c.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-4 w-4 text-emerald-700" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block max-w-[8rem] truncate text-xs font-bold text-[color:var(--text)]">{c.name}</span>
                <span className="block text-[10px] text-[color:var(--muted)]">{c.memberCount} members</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Reused feed: composer trigger + tabs + post cards, logic untouched */}
      <Feed
        posts={posts}
        social={social}
        media={media}
        currentUserId={currentUserId}
        userName={userName}
        userImage={userImage}
        authorTiers={authorTiers}
      />
    </div>
  );
}
