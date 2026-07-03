import { redirect } from "next/navigation";
import { MapPinned } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { CartPlanner } from "./CartPlanner";

export default async function TripCartPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <div className="animate-fadeUp">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
            <MapPinned className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-gradient text-3xl font-extrabold tracking-tight">Trip route</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Everything in your cart, mapped as one route.
            </p>
          </div>
        </header>

        <CartPlanner />
      </div>
    </AppShell>
  );
}
