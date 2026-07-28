import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { getPublicProfile, getFollowCounts, isFollowing } from "@/lib/queries/follows";
import { listMyPosts, getFeedSocial, getPostsMedia } from "@/lib/queries/community";
import { Reveal } from "@/components/app/Reveal";
import { ProfileHeader } from "./ProfileHeader";
import { ProfilePostsSection } from "./ProfilePostsSection";

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

        <section className="card p-6">
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

        <div className="mt-6">
          <ProfilePostsSection
            posts={posts}
            social={social}
            media={media}
            currentUserId={me.id ?? ""}
            userName={me.name || me.email || "You"}
            userImage={me.image}
            displayName={displayName}
          />
        </div>
      </Reveal>
    </AppShell>
  );
}
