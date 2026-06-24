"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Wallet, Users, Menu, type LucideIcon } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/explore-bangalore", label: "Explore", icon: Compass },
  { href: "/community", label: "Community", icon: Users },
];

// Bottom tab bar shown only on small screens — the standard mobile pattern,
// with a raised center "Plan" button. Desktop uses the left sidebar instead.
export function MobileNav({ onMenu }: { onMenu: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="relative mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {/* left two tabs */}
        {TABS.slice(0, 2).map((t) => (
          <TabLink key={t.href} tab={t} active={isActive(t.href)} />
        ))}

        {/* center raised Plan button */}
        <Link
          href="/budget-planner"
          aria-label="Plan a trip"
          className="relative -mt-7 flex flex-col items-center"
        >
          <span
            className={`grid h-14 w-14 place-items-center rounded-full text-white shadow-lg shadow-emerald-500/40 ring-4 ring-white transition ${
              isActive("/budget-planner") ? "bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <Wallet className="h-6 w-6" />
          </span>
          <span className="mt-1 text-[11px] font-semibold text-emerald-700">Plan</span>
        </Link>

        {/* right tab + menu */}
        {TABS.slice(2).map((t) => (
          <TabLink key={t.href} tab={t} active={isActive(t.href)} />
        ))}
        <button
          onClick={onMenu}
          className="flex flex-1 flex-col items-center gap-0.5 text-slate-400"
          aria-label="More"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[11px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={`flex flex-1 flex-col items-center gap-0.5 transition ${
        active ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
      <span className="text-[11px] font-medium">{tab.label}</span>
    </Link>
  );
}
