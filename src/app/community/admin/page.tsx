import { redirect } from "next/navigation";
import { MapPin, ShieldCheck, Check, X } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { isAdmin } from "@/lib/admin";
import { listPendingPosts } from "@/lib/queries/community";
import { approveCommunityPost, rejectCommunityPost } from "@/lib/actions/community";

export default async function CommunityAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;
  if (!isAdmin(u.email)) redirect("/community");

  const pending = await listPendingPosts();

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <header className="mb-6 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Verify community posts</h1>
          <p className="mt-1 text-sm text-slate-500">
            {pending.length} submission{pending.length === 1 ? "" : "s"} awaiting review.
          </p>
        </div>
      </header>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">Nothing to review right now. 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((p) => (
            <article key={p.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt={p.title} className="h-32 w-full rounded-xl object-cover sm:w-48" />
              ) : (
                <div className="grid h-32 w-full place-items-center rounded-xl bg-slate-100 text-3xl sm:w-48">🌄</div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{p.title}</p>
                <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>by {p.authorName ?? "Traveller"}</span>
                  {p.latitude && p.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                    >
                      <MapPin className="h-3 w-3" /> {p.locationName || "View on map"}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:flex-col">
                <form action={approveCommunityPost.bind(null, p.id)}>
                  <button className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                    <Check className="h-4 w-4" /> Publish
                  </button>
                </form>
                <form action={rejectCommunityPost.bind(null, p.id)}>
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <X className="h-4 w-4" /> Reject
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
