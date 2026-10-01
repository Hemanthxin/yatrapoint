import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { PageHero } from "@/components/app/PageHero";
import { listCommunities, getMembershipsForUser } from "@/lib/queries/communities";
import { GroupsDirectory } from "./GroupsDirectory";

export default async function CommunityGroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const u = session.user;

  const [communities, memberships] = await Promise.all([
    listCommunities(),
    getMembershipsForUser(u.id ?? ""),
  ]);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="hidden lg:block">
        <PageHero
          eyebrow="Find your people"
          icon={Users}
          title={<>Travel <span className="italic">Communities</span></>}
          subtitle="Join a group of travellers who share your interests, or start your own — the creator approves who joins."
          gradient="from-emerald-800 via-emerald-700 to-green-700"
        />
      </div>
      <div className="lg:hidden">
        <BackButton fallback="/community" label="Community" />
        <h1 className="mb-4 text-xl font-extrabold tracking-tight text-[color:var(--text)]">Communities</h1>
      </div>

      <GroupsDirectory communities={communities} memberships={memberships} />
    </AppShell>
  );
}
