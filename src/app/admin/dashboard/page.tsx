import { redirect } from "next/navigation";
import { BarChart3, Layers3, MapPinned, EyeOff, MapPin, Tag, ShieldCheck, Users2, Trophy } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { isAdminSession } from "@/lib/admin";
import { ADMIN_ACCOUNTS } from "@/lib/admin";
import { getAdminPlaceStats, listRecentAdminPlaces, listPlacesByAdmin } from "@/lib/queries/admin";
import { AddPlaceForm } from "./AddPlaceForm";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");

  const u = session.user;
  const [stats, recent, contributions] = await Promise.all([
    getAdminPlaceStats(),
    listRecentAdminPlaces(6),
    listPlacesByAdmin(),
  ]);

  // Merge fixed admin list with their contribution counts (0 if none yet).
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
    <AppShell userLabel={u.name || u.email || "Admin"} userImage={u.image}>
      {/* Hero header */}
      <header className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 right-1/4 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-white/85">
              Welcome, {u.name || u.email}. Track the catalogue and add new places.
            </p>
          </div>
        </div>
      </header>

      {/* Stat cards */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total places" value={stats.totalPlaces} icon={<Layers3 className="h-5 w-5" />} tone="from-sky-500 to-blue-600" />
        <StatCard label="Visible places" value={stats.visiblePlaces} icon={<MapPinned className="h-5 w-5" />} tone="from-emerald-500 to-teal-600" />
        <StatCard label="Hidden places" value={stats.hiddenPlaces} icon={<EyeOff className="h-5 w-5" />} tone="from-amber-500 to-orange-600" />
        <StatCard label="Avg popularity" value={stats.averagePopularity} icon={<BarChart3 className="h-5 w-5" />} tone="from-violet-500 to-purple-600" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          {/* Places added by each admin */}
          <Panel title="Places added by each admin" subtitle="Contribution leaderboard" icon={<Users2 className="h-5 w-5 text-slate-400" />}>
            <div className="space-y-3">
              {adminRows.map((a, i) => (
                <div key={a.email} className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${avatarTone(i)}`}>
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {a.name}
                        {i === 0 && a.total > 0 && (
                          <Trophy className="ml-1 inline h-3.5 w-3.5 text-amber-500" />
                        )}
                      </p>
                      <span className="text-sm font-bold text-slate-900">{a.total}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600"
                        style={{ width: `${Math.max(4, (a.total / topTotal) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{a.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Category analysis" subtitle="Places grouped by category" icon={<Tag className="h-5 w-5 text-slate-400" />}>
            <div className="grid gap-3 md:grid-cols-2">
              {stats.byCategory.length === 0 ? (
                <p className="text-sm text-slate-500">No categories yet.</p>
              ) : (
                stats.byCategory.map((item) => <MiniBar key={item.label} label={item.label} total={item.total} />)
              )}
            </div>
          </Panel>

          <Panel title="State analysis" subtitle="Top states where places exist" icon={<MapPin className="h-5 w-5 text-slate-400" />}>
            <div className="grid gap-3 md:grid-cols-2">
              {stats.byState.length === 0 ? (
                <p className="text-sm text-slate-500">No state data yet.</p>
              ) : (
                stats.byState.map((item) => <MiniBar key={item.label} label={item.label} total={item.total} />)
              )}
            </div>
          </Panel>

          <Panel title="Place type analysis" subtitle="Types in the catalogue" icon={<Layers3 className="h-5 w-5 text-slate-400" />}>
            <div className="grid gap-3 md:grid-cols-2">
              {stats.byPlaceType.length === 0 ? (
                <p className="text-sm text-slate-500">No type data yet.</p>
              ) : (
                stats.byPlaceType.map((item) => <MiniBar key={item.label} label={item.label} total={item.total} />)
              )}
            </div>
          </Panel>

          <Panel title="Recent places" subtitle="Latest additions">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recent.length === 0 ? (
                <p className="text-sm text-slate-500">No places added yet.</p>
              ) : (
                recent.map((place) => (
                  <article key={place.id} className="card-hover overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="relative h-32 w-full">
                      {place.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={place.imageUrl} alt={place.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-200 to-slate-100 text-3xl">🗺️</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate font-semibold text-slate-900">{place.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {place.state}{place.district ? ` · ${place.district}` : ""}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <AddPlaceForm />
          <Panel title="Quick summary">
            <div className="space-y-3 text-sm text-slate-600">
              <SummaryRow label="Total places" value={stats.totalPlaces} />
              <SummaryRow label="Visible" value={stats.visiblePlaces} />
              <SummaryRow label="Hidden" value={stats.hiddenPlaces} />
              <SummaryRow label="Admins contributing" value={adminRows.filter((a) => a.total > 0).length} />
            </div>
          </Panel>
        </div>
      </section>
    </AppShell>
  );
}

function avatarTone(i: number): string {
  const tones = [
    "bg-gradient-to-br from-sky-500 to-blue-600",
    "bg-gradient-to-br from-emerald-500 to-teal-600",
    "bg-gradient-to-br from-amber-500 to-orange-600",
    "bg-gradient-to-br from-violet-500 to-purple-600",
    "bg-gradient-to-br from-rose-500 to-pink-600",
  ];
  return tones[i % tones.length];
}

function StatCard({ label, value, icon, tone }: { label: string; value: number | string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="card-hover rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-white`}>
        {icon}
      </div>
      <p className="text-3xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {icon}
      </div>
      {children}
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
