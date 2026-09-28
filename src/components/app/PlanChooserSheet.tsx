"use client";

import Link from "next/link";
import { ChevronRight, Sparkles, Users, Wallet } from "lucide-react";
import { Modal } from "./Modal";

// Offered from the mobile dock's center "Plan" button (and can be reused
// anywhere else a "start a trip" entry point makes sense): a choice between
// the existing auto-generated Budget Planner and the new collaborative
// Group Trip Planner, instead of deep-linking straight to one of them.
export function PlanChooserSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Plan a trip">
      <div className="space-y-3 p-4">
        <ChooserOption
          href="/budget-planner"
          onClose={onClose}
          icon={<Wallet className="h-5 w-5" />}
          title="Automatic Plan Generator"
          subtitle="Saafera builds the whole trip for you — set a budget and go."
          tone="emerald"
        />
        <ChooserOption
          href="/group-trip"
          onClose={onClose}
          icon={<Users className="h-5 w-5" />}
          title="Manual Group Trip Planner"
          subtitle="Invite friends, suggest places, vote, then generate the trip together."
          tone="violet"
        />
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
          <Sparkles className="h-3 w-3" /> You can switch between the two any time.
        </p>
      </div>
    </Modal>
  );
}

function ChooserOption({
  href,
  onClose,
  icon,
  title,
  subtitle,
  tone,
}: {
  href: string;
  onClose: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "emerald" | "violet";
}) {
  const tones = {
    emerald: "from-emerald-500 to-green-600 shadow-emerald-500/30",
    violet: "from-violet-500 to-purple-600 shadow-violet-500/30",
  }[tone];

  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.98] hover:border-slate-300"
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg ${tones}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold tracking-tight text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </Link>
  );
}
