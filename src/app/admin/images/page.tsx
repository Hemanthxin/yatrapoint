import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession } from "@/lib/admin";
import { listPlacesMissingImages } from "@/lib/queries/admin-images";
import { ImagesManager } from "./ImagesManager";

export default async function AdminImagesPage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");

  const missing = await listPlacesMissingImages(24);
  const u = session.user;

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Place photos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search any place across Destinations, One-day trips and City places, and add or replace its
          photo — it goes live on the site immediately.
        </p>
      </div>
      <ImagesManager initialMissing={missing} />
    </AdminShell>
  );
}
