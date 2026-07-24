import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { DestinationCard } from "@/components/app/DestinationCard";
import { listDestinations, listFavoriteIds } from "@/lib/queries/destinations";
import { EmptyState } from "@/components/app/EmptyState";
import { NoDataIllustration } from "@/components/illustrations";
import { Reveal } from "@/components/app/Reveal";

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
      <Reveal>
      <header className="mb-6 flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Hidden <span className="text-gradient">Places</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Offbeat destinations — the ones travel agents rarely sell.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          illustration={NoDataIllustration}
          title="No hidden places yet."
          description="Check back soon — we curate these monthly."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 min-[1700px]:grid-cols-6">
          {items.map((d) => (
            <DestinationCard
              key={d.id}
              destination={d}
              favored={favIds.has(d.id)}
            />
          ))}
        </div>
      )}
      </Reveal>
    </AppShell>
  );
}
