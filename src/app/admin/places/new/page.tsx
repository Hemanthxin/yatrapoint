import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession } from "@/lib/admin";
import { PlaceForm } from "@/app/admin/PlaceForm";
import { BackButton } from "@/components/app/BackButton";

export default async function NewPlacePage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");
  const u = session.user;

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      <BackButton fallback="/admin/places" label="Back to Places" />
      <div className="mx-auto max-w-3xl">
        <PlaceForm mode="add" redirectTo="/admin/places" />
      </div>
    </AdminShell>
  );
}
