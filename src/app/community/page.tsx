import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { listPublishedPosts, getFeedSocial, getPostsMedia } from "@/lib/queries/community";
import { getFollowCounts } from "@/lib/queries/follows";
import { Feed } from "./Feed";
import { MobileCommunity } from "./MobileCommunity";
import { PageHero } from "@/components/app/PageHero";
import { CommunityTopBar } from "./CommunityTopBar";

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const posts = await listPublishedPosts(60);
  const [social, media, followCounts] = await Promise.all([
    getFeedSocial(posts.map((p) => p.id), u.id ?? ""),
    getPostsMedia(posts.map((p) => p.id)),
    getFollowCounts(u.id ?? ""),
  ]);
  const myPostCount = posts.filter((p) => p.userId === u.id).length;
  const displayName = u.name || u.email || u.phone || "Traveller";

  return (
    <AppShell userLabel={displayName} userImage={u.image}>
      {/* ── Mobile (< lg): bespoke community UI ── */}
      <div className="lg:hidden">
        <MobileCommunity
          posts={posts}
          social={social}
          media={media}
          currentUserId={u.id ?? ""}
          userName={u.name || u.email || "You"}
          userImage={u.image}
        />
      </div>

      {/* ── Desktop (≥ lg): flat, minimalist feed + a right rail (≥xl) ── */}
      <div className="hidden lg:block">
        <PageHero
          eyebrow="Real travellers, real places"
          icon={Users}
          title={<>The <span className="italic">Community</span></>}
          subtitle="Double-tap to love, save spots for later, and mark 🎒 Want to go / ✅ Been there — comment & share too."
        />

        <div className="mx-auto flex max-w-7xl items-start gap-8">
          <div className="min-w-0 flex-1">
            {/* Compact icon nav — only shown when the labeled rail (≥xl) is hidden */}
            <div className="mb-3 flex justify-end xl:hidden">
              <CommunityTopBar />
            </div>

            <Feed
              posts={posts}
              social={social}
              media={media}
              currentUserId={u.id ?? ""}
              userName={u.name || u.email || "You"}
              userImage={u.image}
            />
          </div>

          {/* Right rail — mini profile + labeled quick links, IG/X-style */}
          <aside className="sticky top-20 hidden w-72 shrink-0 space-y-4 xl:block">
            <div className="card p-4">
              <Link href="/profile" className="flex items-center gap-3">
                {u.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.image} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--border)]" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-600 text-base font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[color:var(--text)]">{displayName}</p>
                  <p className="text-xs font-medium text-[color:var(--muted)]">View profile</p>
                </div>
              </Link>
              <div className="mt-4 flex items-center justify-around border-t border-[color:var(--border)] pt-3 text-center">
                <div>
                  <p className="text-sm font-bold text-[color:var(--text)]">{myPostCount}</p>
                  <p className="text-[11px] font-medium text-[color:var(--muted)]">Posts</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[color:var(--text)]">{followCounts.followers}</p>
                  <p className="text-[11px] font-medium text-[color:var(--muted)]">Followers</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[color:var(--text)]">{followCounts.following}</p>
                  <p className="text-[11px] font-medium text-[color:var(--muted)]">Following</p>
                </div>
              </div>
            </div>

            <div className="card p-2">
              <CommunityTopBar variant="rail" />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
