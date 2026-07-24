import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { listTripHistory } from "@/lib/queries/trip-history";
import { HistoryList } from "./HistoryList";

export default async function TripHistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const items = await listTripHistory(u.id ?? "");

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp mx-auto max-w-2xl">
        <BackButton fallback="/dashboard" />
        <header className="mt-3 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
            <History className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Trip history
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Plans you've opened or generated — tap one to reopen it.
            </p>
          </div>
        </header>

        <HistoryList items={items} />
      </div>
    </AppShell>
  );
}
