import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { getPublicProfile, getFollowCounts, isFollowing } from "@/lib/queries/follows";
import { listMyPosts, getFeedSocial, getPostsMedia } from "@/lib/queries/community";
import { ExploreGrid } from "@/app/community/ExploreGrid";
import { EmptyState } from "@/components/app/EmptyState";
import { CommunityIllustration } from "@/components/illustrations";
import { Reveal } from "@/components/app/Reveal";
import { ProfileHeader } from "./ProfileHeader";

interface PageProps {
  params: Promise<{ userId: string }>;
}

// Public, viewable-by-anyone-signed-in profile — reached by tapping a name or
// avatar anywhere in the community. Shows only public info (posts, follower
// counts) — private data like saved trips/favourites stays on the owner-only
// /profile page.
export default async function PublicProfilePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const me = session.user;
  const { userId } = await params;

  // Viewing your own public profile just sends you to the full private page.
  if (userId === me.id) redirect("/profile");

  const profile = await getPublicProfile(userId);
  if (!profile) notFound();

  const [posts, counts, iFollow] = await Promise.all([
    listMyPosts(userId),
    getFollowCounts(userId),
    isFollowing(me.id ?? "", userId),
  ]);
  const [social, media] = await Promise.all([
    getFeedSocial(posts.map((p) => p.id), me.id ?? ""),
    getPostsMedia(posts.map((p) => p.id)),
  ]);

  const displayName = profile.name || profile.username || "Traveller";

  return (
    <AppShell userLabel={me.name || me.email || me.phone || "Traveller"} userImage={me.image}>
      <Reveal className="mx-auto max-w-3xl">
        <BackButton fallback="/community" />

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <ProfileHeader
            targetUserId={profile.id}
            name={displayName}
            username={profile.username}
            image={profile.image}
            bio={profile.bio}
            postsCount={posts.length}
            initialFollowerCount={counts.followers}
            followingCount={counts.following}
            initialFollowing={iFollow}
          />
        </section>

        <div className="mt-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900">
            <Users className="h-4 w-4 text-emerald-600" /> Posts
          </h2>
          {posts.length === 0 ? (
            <EmptyState
              illustration={CommunityIllustration}
              title="No posts yet"
              description={`${displayName} hasn't shared any places yet.`}
            />
          ) : (
            <ExploreGrid
              posts={posts}
              social={social}
              currentUserId={me.id ?? ""}
              userName={me.name || me.email || "You"}
              userImage={me.image}
              mediaByPost={media}
            />
          )}
        </div>
      </Reveal>
    </AppShell>
  );
}
