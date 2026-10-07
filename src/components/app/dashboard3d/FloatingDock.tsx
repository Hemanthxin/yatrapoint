"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, Users, CalendarDays, Settings, Menu, type LucideIcon } from "lucide-react";

interface DockItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const DOCK: DockItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/budget-planner", label: "Planner", icon: Wallet },
  { href: "/community", label: "Community", icon: Users },
  { href: "/festivals", label: "Festivals", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

// A compact floating glass capsule replacing the conventional sidebar — the
// brief's "operating system for data" dock. `onMenu` opens the full Sidebar
// as an overlay drawer for anything not on this short list (profile, trip
// history, logout).
export function FloatingDock({ onMenu }: { onMenu: () => void }) {
  const path = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center">
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-full px-2 py-2 backdrop-blur-2xl"
        style={{
          background: "var(--nav-bg, rgba(250, 246, 236, 0.8))",
          boxShadow: "0 0 0 1.5px rgb(var(--ink) / 0.4), 0 16px 26px -14px rgb(var(--shadow) / 0.65)",
        }}
      >
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="grid h-11 w-11 place-items-center rounded-full text-slate-500 transition hover:bg-black/5 hover:text-slate-800"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="mx-1 h-6 w-px bg-black/10" />
        {DOCK.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`group relative grid h-11 w-11 place-items-center rounded-full transition ${
                active ? "bg-emerald-700 text-white" : "text-slate-500 hover:bg-black/5 hover:text-slate-800"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
