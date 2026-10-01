"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { X, Search as SearchIcon, Loader2 } from "lucide-react";
import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import type { UserResult } from "@/lib/queries/search";
import { searchCommunity } from "@/lib/actions/search";
import { ExploreGrid } from "@/app/community/ExploreGrid";
import type { MediaItem } from "@/app/community/MediaCarousel";
import { EmptyState } from "@/components/app/EmptyState";
import { NoDataIllustration } from "@/components/illustrations";

const DEBOUNCE_MS = 350;

export function SearchView({
  initialQuery,
  defaultPosts,
  defaultSocial,
  defaultMedia,
  currentUserId,
  userName,
  userImage,
}: {
  initialQuery: string;
  defaultPosts: CommunityPost[];
  defaultSocial: Record<string, PostSocial>;
  defaultMedia: Record<string, MediaItem[]>;
  currentUserId: string;
  userName: string;
  userImage?: string | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [social, setSocial] = useState<Record<string, PostSocial>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setUsers([]);
      setPosts(null);
      setSocial({});
      return;
    }
    const id = setTimeout(() => {
      startTransition(async () => {
        const res = await searchCommunity(q);
        setUsers(res.users);
        setPosts(res.posts);
        setSocial(res.social);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const showingSearch = query.trim().length > 0;

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)]">
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2.5">
        <Link
          href="/community"
          aria-label="Back to community"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-2)] active:scale-90"
        >
          <X className="h-5 w-5" />
        </Link>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, places, #hashtags…"
            className="w-full rounded-full border border-[color:var(--border)] bg-[color:var(--surface-2)] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-400 focus:bg-[color:var(--surface)] focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-3">
        {!showingSearch ? (
          <ExploreGrid
            posts={defaultPosts}
            social={defaultSocial}
            currentUserId={currentUserId}
            userName={userName}
            userImage={userImage}
            mediaByPost={defaultMedia}
          />
        ) : isPending && posts === null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-5">
            {users.length > 0 && (
              <ul className="mx-auto max-w-lg">
                {users.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/profile/${u.id}`}
                      className="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-[color:var(--surface-2)]"
                    >
                      {u.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.image} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-600 text-base font-bold text-white">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[color:var(--text)]">{u.name}</p>
                        {u.username && (
                          <p className="truncate text-sm text-[color:var(--muted)]">@{u.username}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {posts && posts.length > 0 ? (
              <ExploreGrid
                posts={posts}
                social={social}
                currentUserId={currentUserId}
                userName={userName}
                userImage={userImage}
              />
            ) : (
              users.length === 0 && (
                <EmptyState
                  illustration={NoDataIllustration}
                  title="No results"
                  description={`Nothing matched "${query.trim()}".`}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
