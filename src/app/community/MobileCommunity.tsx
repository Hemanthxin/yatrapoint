import { Users, Sparkles } from "lucide-react";

import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { Feed } from "./Feed";
import { Reveal } from "@/components/app/Reveal";

interface Props {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
  currentUserId: string;
  userName: string;
  userImage?: string | null;
}

// A bespoke, app-first mobile Community — rendered only below `lg`. It frames the
// SAME <Feed/> (composer + tabs + posts, all logic preserved) with a welcoming
// mobile hero header, so nothing about the feed's reaction / comment / edit /
// delete behaviour is duplicated. Coral accent comes automatically from the
// mobile theme, so every `emerald`/`green` utility here paints coral on phones.
export function MobileCommunity({ posts, social, currentUserId, userName, userImage }: Props) {
  return (
    <div className="space-y-5 pb-4">
      {/* Welcoming hero header */}
      <Reveal as="header" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative bg-gradient-to-br from-emerald-500 to-green-600 p-5 text-white">
          <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-10 -left-4 h-24 w-24 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur">
              <Users className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight">Community</h1>
              <p className="text-[13px] font-medium text-white/85">Real places from real travellers</p>
            </div>
          </div>
          <p className="relative mt-3 text-sm font-medium leading-snug text-white/90">
            Double-tap to love, save spots for later, and mark 🎒 Want to go / ✅ Been there — comment &amp; share too.
          </p>
        </div>

        {/* Share prompt strip — points to the real composer that opens below */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-700">
            Share a hidden place{" "}
            <span className="font-medium text-slate-400">— tap the composer below</span>
          </p>
        </div>
      </Reveal>

      {/* Reused feed: composer trigger + tabs + post cards, logic untouched */}
      <Feed
        posts={posts}
        social={social}
        currentUserId={currentUserId}
        userName={userName}
        userImage={userImage}
      />
    </div>
  );
}
