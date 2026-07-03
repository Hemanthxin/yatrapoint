import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { listPublishedPosts, getFeedSocial } from "@/lib/queries/community";
import { Feed } from "./Feed";

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const posts = await listPublishedPosts(60);
  const social = await getFeedSocial(posts.map((p) => p.id), u.id ?? "");

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <header className="mb-6 flex items-start gap-3 animate-fadeUp">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <Users className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            <span className="text-gradient animate-shimmer">Community</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Double-tap to love, save spots for later, and mark 🎒 Want to go / ✅ Been there — comment &amp; share too.
          </p>
        </div>
      </header>

      {/* Centered single-column feed with tabs */}
      <Feed
        posts={posts}
        social={social}
        currentUserId={u.id ?? ""}
        userName={u.name || u.email || "You"}
        userImage={u.image}
      />
    </AppShell>
  );
}
