import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, MapPin, ShieldCheck, Clock } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { isAdmin } from "@/lib/admin";
import { listPublishedPosts, listMyPosts } from "@/lib/queries/community";
import { CommunityForm } from "./CommunityForm";

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const [published, mine] = await Promise.all([
    listPublishedPosts(),
    listMyPosts(u.id),
  ]);
  const pendingMine = mine.filter((p) => p.status === "pending");

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-100 text-sky-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Community</h1>
            <p className="mt-1 text-sm text-slate-500">
              Share hidden gems with live location and photos. Posts go live after admin verification.
            </p>
          </div>
        </div>
        {isAdmin(u.email) && (
          <Link
            href="/community/admin"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Verify posts
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Feed */}
        <div className="lg:col-span-2">
          {pendingMine.length > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Clock className="h-4 w-4" />
              You have {pendingMine.length} post{pendingMine.length > 1 ? "s" : ""} awaiting verification.
            </div>
          )}

          {published.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-sm text-slate-500">
                No community posts published yet. Be the first to share a hidden place!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {published.map((p) => (
                <article key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.title} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="grid h-40 w-full place-items-center bg-gradient-to-br from-emerald-100 to-sky-100 text-3xl">
                      🌄
                    </div>
                  )}
                  <div className="p-4">
                    <p className="font-semibold text-slate-900">{p.title}</p>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-600">{p.description}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
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
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Submit form */}
        <div>
          <CommunityForm />
        </div>
      </div>
    </AppShell>
  );
}
