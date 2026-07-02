import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { DestinationCard } from "@/components/app/DestinationCard";
import { listDestinations, listFavoriteIds } from "@/lib/queries/destinations";

export default async function HiddenPlacesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const [items, favIds] = await Promise.all([
    listDestinations({ isHidden: true, limit: 100 }),
    listFavoriteIds(u.id ?? ""),
  ]);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp">
      <header className="mb-6 flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Hidden Places
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Offbeat destinations — the ones travel agents rarely sell.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-500">
            No hidden places yet. Check back soon — we curate these monthly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((d) => (
            <DestinationCard
              key={d.id}
              destination={d}
              favored={favIds.has(d.id)}
            />
          ))}
        </div>
      )}
      </div>
    </AppShell>
  );
}
