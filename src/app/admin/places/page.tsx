import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, PlusCircle, MapPin, EyeOff } from "lucide-react";

import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession } from "@/lib/admin";
import { listAdminPlaces, placeFacets } from "@/lib/queries/admin";
import { formatINR } from "@/lib/format";
import { Filters } from "./Filters";
import { DeletePlaceButton } from "./DeletePlaceButton";

interface PageProps {
  searchParams: Promise<{ q?: string; state?: string; category?: string; page?: string }>;
}

export default async function AdminPlacesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const [data, facets] = await Promise.all([
    listAdminPlaces({ q: sp.q, state: sp.state, category: sp.category, page, pageSize: 12 }),
    placeFacets(),
  ]);

  const u = session.user;
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.state) params.set("state", sp.state);
    if (sp.category) params.set("category", sp.category);
    params.set("page", String(p));
    return `/admin/places?${params.toString()}`;
  };

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Places</h1>
          <p className="mt-1 text-sm text-slate-500">{data.total} places in the catalogue — search, edit or remove any of them.</p>
        </div>
        <Link
          href="/admin/places/new"
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/40 transition hover:scale-[1.02] active:scale-95"
        >
          <span aria-hidden className="sheen-overlay animate-sheen" />
          <PlusCircle className="relative h-4 w-4" /> <span className="relative">Add place</span>
        </Link>
      </div>

      <Filters states={facets.states} categories={facets.categories} current={{ q: sp.q, state: sp.state, category: sp.category }} />

      {data.rows.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No places match. Try clearing filters, or add a new place.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.rows.map((p) => (
            <div key={p.id} className="card-hover overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="relative h-36 w-full bg-slate-100">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-200 to-slate-100 text-3xl">🗺️</div>
                )}
                {p.isHidden && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <EyeOff className="h-3 w-3" /> Hidden
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="truncate font-semibold text-slate-900">{p.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                  <MapPin className="h-3 w-3" /> {p.state}{p.district ? ` · ${p.district}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{p.category}</span>
                  {p.entryFees > 0 && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">Entry {formatINR(p.entryFees)}</span>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/admin/places/${p.id}/edit`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                  <DeletePlaceButton id={p.id} name={p.name} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: data.pages }).map((_, i) => {
            const n = i + 1;
            const active = n === data.page;
            return (
              <Link
                key={n}
                href={qs(n)}
                className={`grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-bold transition active:scale-95 ${
                  active ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-600/30" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
