import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { getCommunityBySlug, getMembership, listPendingRequests, getAuthorPostCounts } from "@/lib/queries/communities";
import { listPublishedPosts, getFeedSocial, getPostsMedia } from "@/lib/queries/community";
import { getContributorTier } from "@/lib/contributorTier";
import { Feed } from "../../Feed";
import { GroupHeaderActions } from "./GroupHeaderActions";
import { PendingRequests } from "./PendingRequests";
import type { MembershipStatus } from "../JoinButton";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CommunityGroupPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const u = session.user;
  const { slug } = await params;

  const community = await getCommunityBySlug(slug);
  if (!community) notFound();

  const membership = await getMembership(community.id, u.id ?? "");
  const status: MembershipStatus = !membership
    ? "none"
    : membership.role === "owner"
      ? "owner"
      : membership.status === "approved"
        ? "approved"
        : "pending";

  const posts = await listPublishedPosts(60, community.id);
  const [social, media, authorCounts, pendingRequests] = await Promise.all([
    getFeedSocial(posts.map((p) => p.id), u.id ?? ""),
    getPostsMedia(posts.map((p) => p.id)),
    getAuthorPostCounts([...new Set(posts.map((p) => p.userId))]),
    status === "owner" ? listPendingRequests(community.id) : Promise.resolve([]),
  ]);
  const authorTiers: Record<string, string> = {};
  for (const [userId, count] of Object.entries(authorCounts)) {
    const tier = getContributorTier(count);
    if (tier) authorTiers[userId] = tier;
  }

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      {/* max-w-2xl matches <Feed>'s own single-column width exactly, so the
          header card and the posts below it share one left/right edge. */}
      <div className="mx-auto max-w-2xl">
        <BackButton fallback="/community/groups" label="Communities" />

        <div className="card mb-6 overflow-hidden">
          <div className="relative h-36 w-full bg-emerald-100 sm:h-48">
            {community.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={community.coverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <Users className="h-12 w-12" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-[color:var(--text)]">{community.name}</h1>
              <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">{community.description}</p>
              <p className="mt-2 text-xs font-semibold text-[color:var(--muted)]">
                {community.memberCount} {community.memberCount === 1 ? "member" : "members"}
              </p>
            </div>
            <GroupHeaderActions communityId={community.id} initialStatus={status} />
          </div>
        </div>

        {status === "owner" && pendingRequests.length > 0 && (
          <div className="mb-6">
            <PendingRequests communityId={community.id} initialRequests={pendingRequests} />
          </div>
        )}

        <Feed
          posts={posts}
          social={social}
          media={media}
          currentUserId={u.id ?? ""}
          userName={u.name || u.email || "You"}
          userImage={u.image}
          communityId={community.id}
          authorTiers={authorTiers}
        />
      </div>
    </AppShell>
  );
}
