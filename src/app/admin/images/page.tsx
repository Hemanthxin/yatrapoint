import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession } from "@/lib/admin";
import { listPlacesMissingImages, listImageFacets } from "@/lib/queries/admin-images";
import { fetchPlaceGalleriesBatch } from "@/lib/actions/admin-place-gallery";
import { ImagesManager } from "./ImagesManager";

export default async function AdminImagesPage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");

  const [missing, facets] = await Promise.all([listPlacesMissingImages(24), listImageFacets()]);
  const initialGalleries = await fetchPlaceGalleriesBatch(missing.map((r) => ({ id: r.id, source: r.source })));
  const u = session.user;

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Place photos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search any place across Destinations, One-day trips and City places, and add or replace its
          photo, and manage its photo gallery (up to 4 photos with captions) shown on trip-plan stop cards.
        </p>
      </div>
      <ImagesManager
        initialMissing={missing}
        initialGalleries={initialGalleries}
        initialStates={facets.states}
      />
    </AdminShell>
  );
}
