import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, TrendingUp, Award, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { listPublishedPosts, getFeedSocial, getPostsMedia } from "@/lib/queries/community";
import { getFollowCounts } from "@/lib/queries/follows";
import {
  getCommunityStats,
  getTrendingCommunities,
  getTopContributors,
  getAuthorPostCounts,
} from "@/lib/queries/communities";
import { getContributorTier } from "@/lib/contributorTier";
import { Feed } from "./Feed";
import { MobileCommunity } from "./MobileCommunity";
import { PageHero } from "@/components/app/PageHero";
import { CommunityTopBar } from "./CommunityTopBar";
import { ShareJourneyCard } from "./ShareJourneyCard";

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const posts = await listPublishedPosts(60);
  const [social, media, followCounts, stats, trending, topContributors, authorCounts] = await Promise.all([
    getFeedSocial(posts.map((p) => p.id), u.id ?? ""),
    getPostsMedia(posts.map((p) => p.id)),
    getFollowCounts(u.id ?? ""),
    getCommunityStats(),
    getTrendingCommunities(4),
    getTopContributors(5),
    getAuthorPostCounts([...new Set(posts.map((p) => p.userId))]),
  ]);
  const authorTiers: Record<string, string> = {};
  for (const [userId, count] of Object.entries(authorCounts)) {
    const tier = getContributorTier(count);
    if (tier) authorTiers[userId] = tier;
  }
  const myPostCount = posts.filter((p) => p.userId === u.id).length;
  const displayName = u.name || u.email || u.phone || "Traveller";
  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

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
          authorTiers={authorTiers}
          trending={trending}
        />
      </div>

      {/* ── Desktop (≥ lg): flat, minimalist feed + a right rail (≥xl) ── */}
      <div className="hidden lg:block">
        <PageHero
          eyebrow="Welcome to Saafera Community"
          icon={Users}
          title={<>Better Travel <span className="italic">Together</span></>}
          subtitle="Share your travel stories, get tips, ask questions, and connect with fellow explorers."
          gradient="from-emerald-800 via-emerald-700 to-green-700"
          backgroundImage="/community-hero-bg.jpg"
          stats={[
            { label: "Travelers", value: formatCount(stats.travellers) },
            { label: "Posts", value: formatCount(stats.posts) },
            { label: "Communities", value: formatCount(stats.communities) },
          ]}
        />

        {/* justify-between + a capped feed column keeps the feed's left edge
            and the rail's right edge flush with the hero above; the slack
            falls into the gutter between them. */}
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-8">
          <div className="min-w-0 flex-1 xl:max-w-2xl">
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
              authorTiers={authorTiers}
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

            {/* Community stats */}
            <div className="card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--text)]">
                <Sparkles className="h-4 w-4 text-emerald-600" /> Community Stats
              </h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-base font-extrabold text-[color:var(--text)]">{formatCount(stats.travellers)}</p>
                  <p className="text-[11px] font-medium text-[color:var(--muted)]">Travelers</p>
                </div>
                <div>
                  <p className="text-base font-extrabold text-[color:var(--text)]">{formatCount(stats.posts)}</p>
                  <p className="text-[11px] font-medium text-[color:var(--muted)]">Posts</p>
                </div>
                <div>
                  <p className="text-base font-extrabold text-[color:var(--text)]">{formatCount(stats.communities)}</p>
                  <p className="text-[11px] font-medium text-[color:var(--muted)]">Communities</p>
                </div>
              </div>
            </div>

            {/* Join / browse communities CTA */}
            <div className="card space-y-2 p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[color:var(--text)]">
                <Users className="h-4 w-4 text-emerald-600" /> Join a Community
              </h2>
              <p className="text-xs text-[color:var(--muted)]">Be a part of a growing community of travel lovers.</p>
              <Link href="/community/groups" className="btn-primary mt-1 block rounded-xl px-4 py-2.5 text-center text-sm">
                Browse Communities
              </Link>
            </div>

            {/* Trending communities */}
            {trending.length > 0 && (
              <div className="card p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--text)]">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> Trending Now
                </h2>
                <ul className="space-y-2.5">
                  {trending.map((c) => (
                    <li key={c.id}>
                      <Link href={`/community/groups/${c.slug}`} className="flex items-center gap-2.5 rounded-xl transition hover:bg-[color:var(--surface-2)]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-emerald-100">
                          {c.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.coverImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Users className="h-4 w-4 text-emerald-700" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-[color:var(--text)]">{c.name}</span>
                          <span className="block text-[11px] text-[color:var(--muted)]">{c.postCount} posts</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Top contributors */}
            {topContributors.length > 0 && (
              <div className="card p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--text)]">
                  <Award className="h-4 w-4 text-emerald-600" /> Top Contributors
                </h2>
                <ul className="space-y-2.5">
                  {topContributors.map((c, i) => (
                    <li key={c.userId}>
                      <Link href={`/profile/${c.userId}`} className="flex items-center gap-2.5 rounded-xl transition hover:bg-[color:var(--surface-2)]">
                        <span className="w-4 shrink-0 text-center text-xs font-bold text-[color:var(--muted)]">{i + 1}</span>
                        {c.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-[color:var(--text)]">{c.name}</span>
                          <span className="block text-[11px] text-[color:var(--muted)]">{c.postCount} posts</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ShareJourneyCard />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
