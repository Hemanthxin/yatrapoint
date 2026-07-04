import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { AuthCard } from "@/components/AuthCard";
import { Logo } from "@/components/Logo";
import { MapPin, Wallet, Route, ShieldCheck } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (isAdminSession(session?.user)) redirect("/admin/dashboard");
  if (session?.user) redirect("/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Ambient coral glows — no photographic background image. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-28 -top-24 h-80 w-80 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/4 h-72 w-72 rounded-full bg-emerald-600/15 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-7 sm:max-w-lg sm:py-10">
        {/* Brand row */}
        <header className="flex items-center justify-between">
          <Logo tagline />
          <a
            href="/admin-login"
            className="rounded-full border border-slate-200 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur transition hover:bg-white"
          >
            Admin
          </a>
        </header>

        {/* Hero copy */}
        <section className="mt-9 animate-fadeUp">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
            ✨ Plan smarter
          </span>
          <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl">
            Your next trip,
            <br />
            <span className="text-gradient">planned to the rupee.</span>
          </h1>
          <p className="mt-2.5 text-sm font-medium text-slate-500">
            Live routes, real budgets and one-tap plans across India — in one app.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill icon={<MapPin className="h-3.5 w-3.5" />} label="Live routes" />
            <Pill icon={<Wallet className="h-3.5 w-3.5" />} label="Real budgets" />
            <Pill icon={<Route className="h-3.5 w-3.5" />} label="Smart plans" />
          </div>
        </section>

        {/* Auth card */}
        <section className="mt-8 flex-1">
          <AuthCard googleClientId={process.env.AUTH_GOOGLE_ID} />
        </section>

        <footer className="mt-8 flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Explore more, spend smart.
        </footer>
      </div>
    </main>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
      <span className="text-emerald-600">{icon}</span>
      {label}
    </span>
  );
}
