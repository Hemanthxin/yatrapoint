import { redirect } from "next/navigation";
import { BarChart3, Layers3, MapPinned, Sparkles, EyeOff, MapPin, Tag } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { isAdminSession } from "@/lib/admin";
import { getAdminPlaceStats, listRecentAdminPlaces } from "@/lib/queries/admin";
import { AddPlaceForm } from "./AddPlaceForm";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) {
  redirect("/admin-login");
}

const u = session.user;
  const [stats, recent] = await Promise.all([
    getAdminPlaceStats(),
    listRecentAdminPlaces(6),
  ]);

  return (
    <AppShell userLabel={u.name || u.email || "Admin"} userImage={u.image}>
      <header className="mb-6 flex flex-col gap-3 rounded-3xl bg-gradient-to-r from-sky-600 to-blue-700 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-white/85">
              Track every place in the system and add new places in one shot.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total places" value={stats.totalPlaces} icon={<Layers3 className="h-5 w-5" />} />
        <StatCard label="Visible places" value={stats.visiblePlaces} icon={<MapPinned className="h-5 w-5" />} />
        <StatCard label="Hidden places" value={stats.hiddenPlaces} icon={<EyeOff className="h-5 w-5" />} />
        <StatCard label="Avg popularity" value={stats.averagePopularity} icon={<BarChart3 className="h-5 w-5" />} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Category analysis</h2>
                <p className="mt-1 text-sm text-slate-500">Places grouped by category.</p>
              </div>
              <Tag className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {stats.byCategory.length === 0 ? (
                <p className="text-sm text-slate-500">No categories yet.</p>
              ) : (
                stats.byCategory.map((item) => (
                  <MiniBar key={item.label} label={item.label} total={item.total} />
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">State analysis</h2>
                <p className="mt-1 text-sm text-slate-500">Top states where places exist.</p>
              </div>
              <MapPin className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 space-y-3">
              {stats.byState.length === 0 ? (
                <p className="text-sm text-slate-500">No state data yet.</p>
              ) : (
                stats.byState.map((item) => (
                  <MiniBar key={item.label} label={item.label} total={item.total} />
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Place type analysis</h2>
                <p className="mt-1 text-sm text-slate-500">Types you are storing in the catalogue.</p>
              </div>
              <Layers3 className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {stats.byPlaceType.length === 0 ? (
                <p className="text-sm text-slate-500">No type data yet.</p>
              ) : (
                stats.byPlaceType.map((item) => (
                  <MiniBar key={item.label} label={item.label} total={item.total} />
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Recent places</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recent.map((place) => (
                <article key={place.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="relative h-40 w-full">
                    {place.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={place.imageUrl} alt={place.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-200 to-slate-100 text-3xl">
                        🗺️
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-slate-900">{place.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {place.state}{place.district ? ` · ${place.district}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                      {place.shortDescription}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <AddPlaceForm />

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Quick summary</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <SummaryRow label="Total places" value={stats.totalPlaces} />
              <SummaryRow label="Visible" value={stats.visiblePlaces} />
              <SummaryRow label="Hidden" value={stats.hiddenPlaces} />
              <SummaryRow label="Avg popularity" value={stats.averagePopularity} />
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-slate-500">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function MiniBar({ label, total }: { label: string; total: number }) {
  const width = Math.max(12, Math.min(100, total * 8));
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">{label}</p>
        <span className="text-sm text-slate-500">{total}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
