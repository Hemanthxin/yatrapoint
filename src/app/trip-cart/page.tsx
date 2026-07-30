import { redirect } from "next/navigation";
import { MapPinned } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { CartPlanner } from "./CartPlanner";
import { Reveal } from "@/components/app/Reveal";
import { PageHero } from "@/components/app/PageHero";

export default async function TripCartPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <Reveal amount={0}>
        {/* Mobile (< lg): app-style hero header */}
        <header className="lg:hidden mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
            <MapPinned className="h-3 w-3" /> Trip route
          </span>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
            Your <span className="text-gradient">trip cart</span>
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Everything you saved, mapped as one route.
          </p>
        </header>

        {/* Desktop (≥ lg): editorial banner */}
        <div className="hidden lg:block">
          <PageHero
            eyebrow="All in one route"
            icon={MapPinned}
            title={<>Your <span className="italic">Trip Route</span></>}
            subtitle="Everything in your cart, mapped as one route."
            backgroundImage="/pagehero-bg.jpg"
          />
        </div>

        <CartPlanner />
      </Reveal>
    </AppShell>
  );
}
