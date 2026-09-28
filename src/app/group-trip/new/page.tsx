import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { PageHero } from "@/components/app/PageHero";
import { listStates } from "@/lib/queries/destinations";
import { NewGroupTripForm } from "./NewGroupTripForm";

export default async function NewGroupTripPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const states = await listStates();

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <PageHero
        eyebrow="Step 1 of 2"
        icon={Users}
        title="Create Group Trip"
        subtitle="Set the basics — you can invite friends and pick places next."
        backgroundImage="/pagehero-bg.jpg"
      />
      <div className="mx-auto mt-6 max-w-xl">
        <NewGroupTripForm states={states} />
      </div>
    </AppShell>
  );
}
