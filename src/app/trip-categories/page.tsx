import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { CATEGORIES, CATEGORY_GRADIENT, type CategorySlug } from "@/lib/catalog/categories";
import { countsByCategory } from "@/lib/queries/destinations";

export default async function TripCategoriesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const counts = await countsByCategory();
  const byCat = Object.fromEntries(counts.map((c) => [c.category, c.total]));

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <header className="mb-6 flex items-start gap-3 animate-fadeUp">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 text-white shadow-lg shadow-emerald-500/30">
          <LayoutGrid className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Trip <span className="text-gradient">Categories</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Pick the kind of trip you're in the mood for.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/destinations?category=${c.slug}`}
            className="card-hover animate-fadeUp group relative h-40 overflow-hidden rounded-3xl border border-slate-200 shadow-lg shadow-emerald-500/5 sm:h-48"
          >
            <div
              className={`absolute inset-0 grid place-items-center bg-gradient-to-br ${
                CATEGORY_GRADIENT[c.slug as CategorySlug]
              }`}
            >
              <span className="text-6xl drop-shadow-md transition duration-500 group-hover:scale-110 sm:text-7xl">
                {c.emoji}
              </span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-lg font-extrabold tracking-tight text-white drop-shadow sm:text-xl">
                {c.label}
              </p>
              <p className="text-xs font-semibold text-white/85">
                {byCat[c.slug] ?? 0} destinations
              </p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
