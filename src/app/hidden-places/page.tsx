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
      <header className="mb-6 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hidden Places</h1>
          <p className="mt-1 text-sm text-slate-500">
            Offbeat destinations — the ones travel agents rarely sell.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">
            No hidden places yet. Check back soon — we curate these monthly.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <DestinationCard
              key={d.id}
              destination={d}
              favored={favIds.has(d.id)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
