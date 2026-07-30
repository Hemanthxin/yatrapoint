import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession } from "@/lib/admin";
import { FESTIVALS } from "@/lib/festivals";
import { getFestivalImages } from "@/lib/actions/festival-images";
import { FestivalImagesManager } from "./FestivalImagesManager";

export default async function AdminFestivalsPage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");

  const images = await getFestivalImages();
  const u = session.user;

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Festival photos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add or replace a photo for any festival — it shows up on the Festivals &amp; Events page immediately,
          in place of the emoji.
        </p>
      </div>
      <FestivalImagesManager festivals={FESTIVALS} initialImages={images} />
    </AdminShell>
  );
}
