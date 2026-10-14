import { redirect } from "next/navigation";
import Link from "next/link";
import { CarFront, ClipboardList, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { Reveal } from "@/components/app/Reveal";
import { CAR_BOOKING_ENABLED } from "@/lib/cab/flags";
import { listBookableVehicles } from "@/lib/cab/core";
import { CarsBrowser } from "./CarsBrowser";

export const dynamic = "force-dynamic";

// Where drivers register their vehicle. Override with NEXT_PUBLIC_CAPTAIN_URL if the app moves.
const CAPTAIN_URL = process.env.NEXT_PUBLIC_CAPTAIN_URL ?? "https://captain.saafera.com";

export default async function CarsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!CAR_BOOKING_ENABLED) redirect("/dashboard");
  const u = session.user;

  const vehicles = await listBookableVehicles();

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <Reveal className="mx-auto max-w-5xl">
        <BackButton fallback="/dashboard" />
        <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
              <CarFront className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Book a car</h1>
              <p className="text-sm font-medium text-slate-500">Pick a verified driver and vehicle — they get your request instantly.</p>
            </div>
          </div>
          <Link href="/cars/bookings" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            <ClipboardList className="h-4 w-4" /> My bookings
          </Link>
        </header>

        <CarsBrowser vehicles={JSON.parse(JSON.stringify(vehicles))} />

        <a href={CAPTAIN_URL} target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center justify-between gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 transition hover:bg-emerald-100">
          <div>
            <div className="font-extrabold text-emerald-900">Own a car? Drive with Saafera</div>
            <div className="text-sm text-emerald-800">Register your vehicle on Saafera Captain, set your own rate per km and get bookings directly.</div>
          </div>
          <ExternalLink className="h-5 w-5 shrink-0 text-emerald-700" />
        </a>
      </Reveal>
    </AppShell>
  );
}
