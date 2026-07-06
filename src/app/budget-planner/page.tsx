import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { WizardForm } from "./WizardForm";

export default async function BudgetPlannerPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      {/* Mobile-only app-style hero — desktop keeps the wizard's own inline header. */}
      <div className="lg:hidden -mx-4 mb-5 border-b border-slate-200 bg-white px-4 pb-5 pt-1 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/30">
            <Wallet className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Budget Planner</h1>
            <p className="text-sm text-slate-500">Plan a trip that fits your budget — in a few quick steps.</p>
          </div>
        </div>
      </div>
      <WizardForm initial={{}} />
    </AppShell>
  );
}
