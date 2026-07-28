import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPublishedPosts, getFeedSocial, getPostsMedia } from "@/lib/queries/community";
import { SearchView } from "./SearchView";

interface PageProps {
  searchParams: Promise<{ tag?: string }>;
}

export default async function CommunitySearchPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const u = session.user;
  const { tag } = await searchParams;

  const posts = await listPublishedPosts(60);
  const [social, media] = await Promise.all([
    getFeedSocial(posts.map((p) => p.id), u.id ?? ""),
    getPostsMedia(posts.map((p) => p.id)),
  ]);

  return (
    <SearchView
      initialQuery={tag ? `#${tag}` : ""}
      defaultPosts={posts}
      defaultSocial={social}
      defaultMedia={media}
      currentUserId={u.id ?? ""}
      userName={u.name || u.email || "You"}
      userImage={u.image}
    />
  );
}
