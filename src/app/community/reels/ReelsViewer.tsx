"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { ReelItem } from "./ReelItem";

export function ReelsViewer({
  posts,
  social,
  userName,
  userImage,
}: {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  userName: string;
  userImage?: string | null;
}) {
  const emptySocial: PostSocial = { counts: { love: 0, wantToGo: 0, beenThere: 0 }, total: 0, comments: 0, mine: null };

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <Link
        href="/community"
        aria-label="Back to community"
        className="absolute left-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
      >
        <X className="h-5 w-5" />
      </Link>
      <p className="absolute left-1/2 top-3 z-30 -translate-x-1/2 text-sm font-bold text-white drop-shadow">Reels</p>

      <div className="h-full w-full snap-y snap-mandatory overflow-y-scroll no-scrollbar">
        {posts.map((post) => (
          <div key={post.id} className="h-full w-full">
            <ReelItem post={post} social={social[post.id] ?? emptySocial} userName={userName} userImage={userImage} />
          </div>
        ))}
      </div>
    </div>
  );
}
