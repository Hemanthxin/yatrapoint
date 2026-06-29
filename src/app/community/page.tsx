import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { listPublishedPosts, getFeedSocial, emptySocial } from "@/lib/queries/community";
import { CommunityForm } from "./CommunityForm";
import { PostCard } from "./PostCard";

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const posts = await listPublishedPosts(60);
  const social = await getFeedSocial(posts.map((p) => p.id), u.id ?? "");

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <header className="mb-6 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-100 text-sky-700">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community</h1>
          <p className="mt-1 text-sm text-slate-500">
            Double-tap to love, save spots for later, and mark 🎒 Want to go / ✅ Been there — comment &amp; share too.
          </p>
        </div>
      </header>

      {/* Centered single-column feed */}
      <div className="mx-auto max-w-2xl space-y-6">
        <CommunityForm />

        {posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-sm text-slate-500">No posts yet — be the first to share a place!</p>
          </div>
        ) : (
          posts.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              social={social[p.id] ?? emptySocial()}
              userName={u.name || u.email || "You"}
              userImage={u.image}
              index={i}
            />
          ))
        )}
      </div>
    </AppShell>
  );
}
