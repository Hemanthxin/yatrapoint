import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AppShell } from "@/components/app/AppShell";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id!))
    .limit(1);
  if (!row) redirect("/");

  const u = session.user;
  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <SettingsClient
        initial={{
          name: row.name ?? "",
          username: row.username ?? "",
          bio: row.bio ?? "",
          email: row.email ?? "",
          phone: row.phone ?? "",
        }}
      />
    </AppShell>
  );
}
