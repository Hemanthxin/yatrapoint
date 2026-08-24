import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession } from "@/lib/admin";
import { FESTIVALS } from "@/lib/festivals";
import { getFestivalImages } from "@/lib/actions/festival-images";
import {
  listApprovedFestivals,
  listPendingFestivalSuggestions,
} from "@/lib/actions/festival-suggestions";
import { FestivalImagesManager } from "./FestivalImagesManager";
import { SuggestionsQueue } from "./SuggestionsQueue";

export default async function AdminFestivalsPage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");

  const [images, pending, approved] = await Promise.all([
    getFestivalImages(),
    listPendingFestivalSuggestions(),
    listApprovedFestivals(),
  ]);
  const u = session.user;

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      {/* Community submissions first — they're the queue that needs acting on
          (BUG-10); photos below are an any-time housekeeping task. */}
      <section className="mb-10">
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            Festival suggestions
            {pending.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-1 align-middle text-sm font-bold text-amber-800">
                {pending.length} waiting
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Local festivals and events submitted by travellers. Approving one publishes it on the
            Festivals &amp; Events page.
          </p>
        </div>
        <SuggestionsQueue initial={pending} />
      </section>

      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Festival photos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add or replace a photo for any festival — it shows up on the Festivals &amp; Events page immediately,
            in place of the emoji.
          </p>
        </div>
        <FestivalImagesManager festivals={[...FESTIVALS, ...approved]} initialImages={images} />
      </section>
    </AdminShell>
  );
}
