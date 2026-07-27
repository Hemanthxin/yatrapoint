import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { listPublishedPosts, getFeedSocial } from "@/lib/queries/community";
import { Feed } from "./Feed";
import { MobileCommunity } from "./MobileCommunity";
import { PageHero } from "@/components/app/PageHero";

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const posts = await listPublishedPosts(60);
  const social = await getFeedSocial(posts.map((p) => p.id), u.id ?? "");

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      {/* ── Mobile (< lg): bespoke community UI ── */}
      <div className="lg:hidden">
        <MobileCommunity
          posts={posts}
          social={social}
          currentUserId={u.id ?? ""}
          userName={u.name || u.email || "You"}
          userImage={u.image}
        />
      </div>

      {/* ── Desktop (≥ lg): the original community feed, unchanged ── */}
      <div className="hidden lg:block">
      <PageHero
        eyebrow="Real travellers, real places"
        icon={Users}
        title={<>The <span className="italic">Community</span></>}
        subtitle="Double-tap to love, save spots for later, and mark 🎒 Want to go / ✅ Been there — comment & share too."
      />

      {/* Centered single-column feed with tabs */}
      <Feed
        posts={posts}
        social={social}
        currentUserId={u.id ?? ""}
        userName={u.name || u.email || "You"}
        userImage={u.image}
      />
      </div>
    </AppShell>
  );
}
