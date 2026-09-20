import Link from "next/link";
import { Film, ChevronRight } from "lucide-react";

// BUG-11: Reels had no clear way in. It existed only as one unlabelled icon in
// a row of five in the community top bar — nothing on the Community screen said
// the word "Reels" or looked like a way to watch them, so travellers never
// found the feed. This is an explicit, labelled entry point placed at the top
// of the Community screen on both layouts, alongside the icon that is still in
// the top bar.
export function ReelsEntry({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/community/reels"
      aria-label="Watch Reels"
      className={`group flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-sm transition hover:border-fuchsia-300 active:scale-[0.99] ${className}`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-orange-400 text-white shadow-md shadow-fuchsia-500/30">
        <Film className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold tracking-tight text-[color:var(--text)]">
          Reels
        </span>
        <span className="block text-xs font-medium text-[color:var(--muted)]">
          Watch travel videos from the community
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--muted)] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
