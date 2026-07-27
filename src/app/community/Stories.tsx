"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { StoryViewer } from "./StoryViewer";

interface Author {
  userId: string;
  name: string;
  image: string | null;
  posts: CommunityPost[];
}

const MAX_AUTHORS = 24;
const RECENT_MS = 24 * 60 * 60 * 1000; // real Instagram-style story window: last 24 hours

// Instagram-style horizontal ring of recent posters — tapping one opens a
// full-screen story viewer cycling through that traveller's shares from the
// last 24 hours. There's no separate "stories" table: a story is just "this
// person's posts from the last day", grouped and viewed one at a time — once
// a post passes 24h old it simply stops showing up here (it's still a normal
// permanent post in the feed/grid, exactly like Instagram's stories-vs-posts
// split).
export function Stories({
  posts,
  social,
  currentUserId,
  onOpenComposer,
}: {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  currentUserId: string;
  onOpenComposer: () => void;
}) {
  const [activeAuthor, setActiveAuthor] = useState<Author | null>(null);

  const authors = useMemo(() => {
    const cutoff = Date.now() - RECENT_MS;
    const byUser = new Map<string, Author>();
    for (const p of posts) {
      const created = new Date(p.createdAt).getTime();
      if (created < cutoff) continue;
      const existing = byUser.get(p.userId);
      if (existing) {
        existing.posts.push(p);
      } else {
        byUser.set(p.userId, {
          userId: p.userId,
          name: p.authorName ?? "Traveller",
          image: p.authorImage ?? null,
          posts: [p],
        });
      }
    }
    return [...byUser.values()]
      .map((a) => ({ ...a, posts: a.posts.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()) }))
      .sort((a, b) => new Date(b.posts[0].createdAt).getTime() - new Date(a.posts[0].createdAt).getTime())
      .slice(0, MAX_AUTHORS);
  }, [posts]);

  if (authors.length === 0) return null;

  return (
    <>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={onOpenComposer}
          className="flex shrink-0 flex-col items-center gap-1.5"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-600">
            <Plus className="h-6 w-6" />
          </span>
          <span className="max-w-[4.5rem] truncate text-[11px] font-semibold text-slate-500">Share</span>
        </button>

        {authors.map((a) => {
          const isMine = a.userId === currentUserId;
          return (
            <button
              key={a.userId}
              type="button"
              onClick={() => setActiveAuthor(a)}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <span className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2.5px]">
                <span className="block rounded-full bg-white p-[2px]">
                  {a.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-lg font-bold text-white">
                      {a.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              </span>
              <span className="max-w-[4.5rem] truncate text-[11px] font-semibold text-slate-600">
                {isMine ? "You" : a.name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {activeAuthor && (
        <StoryViewer
          author={activeAuthor}
          social={social}
          onClose={() => setActiveAuthor(null)}
        />
      )}
    </>
  );
}
