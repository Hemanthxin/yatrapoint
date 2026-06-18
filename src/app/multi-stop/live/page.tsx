import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { MultiStopLive } from "./MultiStopLive";

export default async function MultiStopLivePage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur">
        <Link
          href="/budget-planner"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to planner
        </Link>
        <p className="text-sm font-semibold text-white">Live trip</p>
        <span className="w-16" />
      </header>
      <MultiStopLive />
    </div>
  );
}
