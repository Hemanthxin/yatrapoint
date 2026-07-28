import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial, PostMediaItem } from "@/lib/queries/community";
import { Feed } from "./Feed";
import { CommunityTopBar } from "./CommunityTopBar";

interface Props {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  media?: Record<string, PostMediaItem[]>;
  currentUserId: string;
  userName: string;
  userImage?: string | null;
}

// A bespoke, app-first mobile Community — rendered only below `lg`. It frames the
// SAME <Feed/> (composer + tabs + posts, all logic preserved) with a slim,
// Instagram-style app-bar (wordmark + icon nav, no big banner), so nothing
// about the feed's reaction / comment / edit / delete behaviour is duplicated.
export function MobileCommunity({ posts, social, media, currentUserId, userName, userImage }: Props) {
  return (
    <div className="space-y-4 pb-4">
      <header className="sticky top-2 z-10 flex items-center justify-between gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-extrabold tracking-tight text-[color:var(--text)]">Community</h1>
        <CommunityTopBar />
      </header>

      {/* Reused feed: composer trigger + tabs + post cards, logic untouched */}
      <Feed
        posts={posts}
        social={social}
        media={media}
        currentUserId={currentUserId}
        userName={userName}
        userImage={userImage}
      />
    </div>
  );
}
