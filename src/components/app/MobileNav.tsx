"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Wallet, Users, Menu, type LucideIcon } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LEFT: Tab[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/explore-bangalore", label: "Explore", icon: Compass },
];
const RIGHT: Tab[] = [{ href: "/community", label: "Community", icon: Users }];

// Floating glass dock — detached from the bottom edge, with a raised, glowing
// "Plan" button at its center. Shown only on small screens; desktop uses the
// left sidebar. This is the signature piece of the immersive mobile shell.
export function MobileNav({ onMenu }: { onMenu: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
      {/* Fade scrim so content scrolling underneath doesn't clash with the dock */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-50 via-slate-50/70 to-transparent"
      />

      <nav className="relative mx-auto mb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex h-16 max-w-[22rem] animate-dockIn items-center justify-around rounded-[1.75rem] border border-white/60 glass-strong px-2 shadow-[0_18px_50px_-12px_rgba(2,6,23,0.4)]">
        {LEFT.map((t) => (
          <TabLink key={t.href} tab={t} active={isActive(t.href)} />
        ))}

        {/* Raised center Plan button */}
        <Link
          href="/budget-planner"
          aria-label="Plan a trip"
          className="relative -mt-9 flex flex-col items-center"
        >
          <span className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 text-white ring-[5px] ring-slate-50 shadow-lg shadow-emerald-500/40 animate-glow transition active:scale-95">
            <span aria-hidden className="sheen-overlay animate-sheen" />
            <Wallet className="relative h-6 w-6" strokeWidth={2.2} />
          </span>
          <span className="mt-1 text-[11px] font-bold text-emerald-700">Plan</span>
        </Link>

        {RIGHT.map((t) => (
          <TabLink key={t.href} tab={t} active={isActive(t.href)} />
        ))}

        <button
          onClick={onMenu}
          className="group relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-slate-400"
          aria-label="More"
        >
          <Menu className="h-5 w-5 transition group-active:scale-90" />
          <span className="text-[10px] font-semibold">More</span>
        </button>
      </nav>
    </div>
  );
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className="group relative flex h-full flex-1 flex-col items-center justify-center gap-1"
    >
      <span
        aria-hidden
        className={`absolute top-1.5 h-9 w-12 rounded-2xl bg-gradient-to-b from-emerald-100 to-emerald-50 transition-all duration-300 ${
          active ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      />
      <Icon
        className={`relative h-5 w-5 transition-all duration-300 group-active:scale-90 ${active ? "-translate-y-0.5 text-emerald-600" : "text-slate-400"}`}
        strokeWidth={active ? 2.5 : 1.9}
      />
      <span className={`relative text-[10px] font-semibold ${active ? "text-emerald-700" : "text-slate-400"}`}>
        {tab.label}
      </span>
    </Link>
  );
}
