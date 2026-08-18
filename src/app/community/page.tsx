import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, TrendingUp, Award } from "lucide-react";

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
    getTrendingCommunities(3),
    getTopContributors(4),
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

      {/* ── Desktop (≥ lg): pinned left rail (≥xl) + the feed ── */}
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

        {/* The feed column takes all remaining width (no cap) so the card grid
            fills it — capping it left a dead gutter between feed and rail. */}
        <div className="mx-auto flex max-w-7xl items-start gap-6">
          {/* Left rail — mini profile + labeled quick links, IG/X-style.
              `sticky` pins it while the feed scrolls past (this only works
              because AppShell uses overflow-x-CLIP, not hidden — see there).

              It must fit any desktop height without scrolling, so the cards
              form a priority ladder keyed off viewport height: profile + nav +
              top contributors always fit (~520px, fine on a 768px screen),
              Trending joins at ≥800px and Share Your Journey at ≥900px. The
              max-h/overflow pair is only a backstop for odd window sizes or
              zoomed text — at these breakpoints nothing actually scrolls, and
              the scrollbar is hidden either way. */}
          <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-72 shrink-0 space-y-3 overflow-y-auto [scrollbar-width:none] xl:block [&::-webkit-scrollbar]:hidden">
            <div className="card p-3">
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
              <div className="mt-3 flex items-center justify-around border-t border-[color:var(--border)] pt-2.5 text-center">
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

            <div className="card p-1.5">
              <CommunityTopBar variant="rail" />
            </div>

            {/* No "Community Stats" card here: the hero directly above already
                shows Travelers / Posts / Communities as large stat pills, and
                no "Join a Community" card: the Groups link in the nav above
                goes to the same place. Both were duplicates, and dropping them
                is what lets the rail fit on screen without its own scrollbar. */}

            {/* Trending communities — a nice-to-have, so it only appears once
                the window is tall enough to take it without the rail needing
                to scroll (see the height ladder on <aside> above). */}
            {trending.length > 0 && (
              <div className="card hidden p-3 [@media(min-height:800px)]:block">
                <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-[color:var(--text)]">
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

            {/* Top contributors — drops out on short laptop windows (≤680px
                viewport) where profile + nav alone already fill the rail. */}
            {topContributors.length > 0 && (
              <div className="card hidden p-3 [@media(min-height:680px)]:block">
                <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-[color:var(--text)]">
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

            <div className="hidden [@media(min-height:900px)]:block">
              <ShareJourneyCard />
            </div>
          </aside>

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
              authorTiers={authorTiers}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
