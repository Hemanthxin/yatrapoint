import { redirect } from "next/navigation";
import {
  Layers3,
  MapPinned,
  EyeOff,
  BarChart3,
  Tag,
  MapPin,
  Users2,
  Trophy,
  PlusCircle,
  ArrowUpRight,
} from "lucide-react";

import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession, ADMIN_ACCOUNTS } from "@/lib/admin";
import { getAdminPlaceStats, listRecentAdminPlaces, listPlacesByAdmin } from "@/lib/queries/admin";
import { AddPlaceForm } from "./AddPlaceForm";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");

  const u = session.user;
  const [stats, recent, contributions] = await Promise.all([
    getAdminPlaceStats(),
    listRecentAdminPlaces(8),
    listPlacesByAdmin(),
  ]);

  const byEmail = new Map(contributions.map((c) => [c.email.toLowerCase(), c]));
  const adminRows: Array<{ name: string; email: string; total: number }> = ADMIN_ACCOUNTS.map((a) => ({
    name: a.name as string,
    email: a.email as string,
    total: byEmail.get(a.email)?.total ?? 0,
  }));
  for (const c of contributions) {
    if (!ADMIN_ACCOUNTS.some((a) => a.email === c.email.toLowerCase())) {
      adminRows.push({ name: c.name, email: c.email, total: c.total });
    }
  }
  adminRows.sort((a, b) => b.total - a.total);
  const topTotal = Math.max(1, ...adminRows.map((r) => r.total));

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      {/* Title row */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Dashboard overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {u.name || u.email}. Here&apos;s what&apos;s in the catalogue.
          </p>
        </div>
        <a
          href="#add-place"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700"
        >
          <PlusCircle className="h-4 w-4" /> Add a place
        </a>
      </div>

      {/* KPI cards */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total places" value={stats.totalPlaces} icon={<Layers3 className="h-5 w-5" />} tone="from-indigo-500 to-violet-600" />
        <Kpi label="Visible places" value={stats.visiblePlaces} icon={<MapPinned className="h-5 w-5" />} tone="from-emerald-500 to-teal-600" />
        <Kpi label="Hidden places" value={stats.hiddenPlaces} icon={<EyeOff className="h-5 w-5" />} tone="from-amber-500 to-orange-600" />
        <Kpi label="Avg popularity" value={stats.averagePopularity} icon={<BarChart3 className="h-5 w-5" />} tone="from-sky-500 to-cyan-600" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-6">
          {/* Per-admin leaderboard */}
          <Panel title="Places added by each admin" subtitle="Contribution leaderboard" icon={<Users2 className="h-5 w-5 text-slate-400" />}>
            <div className="space-y-4">
              {adminRows.map((a, i) => (
                <div key={a.email} className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white ${avatarTone(i)}`}>
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1 truncate text-sm font-semibold text-slate-900">
                        {a.name}
                        {i === 0 && a.total > 0 && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                      </p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                        {a.total} {a.total === 1 ? "place" : "places"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all"
                        style={{ width: `${Math.max(4, (a.total / topTotal) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-400">{a.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Analytics row */}
          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="By category" icon={<Tag className="h-5 w-5 text-slate-400" />}>
              <BarList items={stats.byCategory} empty="No categories yet." />
            </Panel>
            <Panel title="By state" icon={<MapPin className="h-5 w-5 text-slate-400" />}>
              <BarList items={stats.byState} empty="No state data yet." />
            </Panel>
          </div>

          <Panel title="By place type" icon={<Layers3 className="h-5 w-5 text-slate-400" />}>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <BarList items={stats.byPlaceType} empty="No type data yet." />
            </div>
          </Panel>

          {/* Recent places as a table */}
          <Panel title="Recent places" subtitle="Latest additions to the catalogue">
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">No places added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-medium">Place</th>
                      <th className="py-2 pr-3 font-medium">State</th>
                      <th className="py-2 pr-3 font-medium">Category</th>
                      <th className="py-2 pr-3 font-medium">Added by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-lg">🗺️</div>
                              )}
                            </div>
                            <span className="font-semibold text-slate-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">{p.state}</td>
                        <td className="py-3 pr-3">
                          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-slate-500">{p.addedByName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div id="add-place" className="scroll-mt-20">
            <AddPlaceForm />
          </div>
          <Panel title="Quick summary">
            <div className="space-y-3 text-sm">
              <SummaryRow label="Total places" value={stats.totalPlaces} />
              <SummaryRow label="Visible" value={stats.visiblePlaces} />
              <SummaryRow label="Hidden" value={stats.hiddenPlaces} />
              <SummaryRow label="Admins contributing" value={adminRows.filter((a) => a.total > 0).length} />
            </div>
          </Panel>
        </div>
      </section>
    </AdminShell>
  );
}

function avatarTone(i: number): string {
  const tones = [
    "bg-gradient-to-br from-indigo-500 to-violet-600",
    "bg-gradient-to-br from-emerald-500 to-teal-600",
    "bg-gradient-to-br from-amber-500 to-orange-600",
    "bg-gradient-to-br from-sky-500 to-cyan-600",
    "bg-gradient-to-br from-rose-500 to-pink-600",
  ];
  return tones[i % tones.length];
}

function Kpi({ label, value, icon, tone }: { label: string; value: number | string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="card-hover rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${tone} text-white`}>
          {icon}
        </div>
        <ArrowUpRight className="h-4 w-4 text-slate-300" />
      </div>
      <p className="mt-4 text-3xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {icon}
      </div>
      {children}
    </div>
  );
}

function BarList({ items, empty }: { items: { label: string; total: number }[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{it.label}</span>
            <span className="text-slate-400">{it.total}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600" style={{ width: `${(it.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-600">{label}</span>
       <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
