import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listVideoPosts, getFeedSocial } from "@/lib/queries/community";
import { ReelsViewer } from "./ReelsViewer";

// Full-screen vertical Reels feed — every post whose first media item is a
// video. Rendered fixed/full-viewport (no AppShell chrome), same as
// Instagram's Reels tab.
export default async function ReelsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const posts = await listVideoPosts(40);
  const social = await getFeedSocial(posts.map((p) => p.id), u.id ?? "");

  if (posts.length === 0) {
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-black text-center text-white">
        <div>
          <p className="text-lg font-bold">No reels yet</p>
          <p className="mt-1 text-sm text-white/70">Post a video from Community to start Reels.</p>
          <a href="/community" className="mt-4 inline-block rounded-full bg-white/15 px-5 py-2.5 text-sm font-bold backdrop-blur">
            Back to Community
          </a>
        </div>
      </div>
    );
  }

  return (
    <ReelsViewer
      posts={posts}
      social={social}
      userName={u.name || u.email || "You"}
      userImage={u.image}
    />
  );
}
