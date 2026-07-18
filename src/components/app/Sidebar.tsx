"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Wallet,
  MapPin,
  CalendarDays,
  Flag,
  Bookmark,
  Settings,
  LogOut,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { signOutAction } from "@/lib/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/destinations", label: "Tourist Places", icon: Flag },
  { href: "/budget-planner", label: "Trip Planner", icon: Wallet },
  { href: "/explore-bangalore", label: "Near By Places", icon: MapPin },
  { href: "/community", label: "Community", icon: Users },
  { href: "/festivals", label: "Festivals & Events", icon: CalendarDays },
  { href: "/profile", label: "Your Travel Places", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();

  return (
    <>
      {/* Mobile backdrop — blurred so the drawer feels layered over the app */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl transition-transform duration-300 ease-out lg:w-64 lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" className="text-slate-900" aria-label="Home">
            <Logo tagline />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 no-scrollbar">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-[color:var(--surface-2)] font-semibold text-[color:var(--accent)]"
                    : "font-medium text-[color:var(--text-soft)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
                }`}
              >
                {/* Thin accent rail on the active item. */}
                <span
                  aria-hidden
                  className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[color:var(--accent)] transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition ${active ? "text-[color:var(--accent)]" : "text-[color:var(--muted)] group-hover:text-[color:var(--text)]"}`}
                  strokeWidth={2}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Promo — minimalist tinted panel. */}
        <div className="mx-3 mb-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4">
          <p className="text-sm font-semibold text-[color:var(--text)]">Plan your trip smarter</p>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted)]">
            AI suggestions, custom itineraries and budget-friendly trips.
          </p>
          <Link
            href="/budget-planner"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-2)]"
          >
            Explore Now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <form action={signOutAction} className="border-t border-[color:var(--border)] p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.8} /> Logout
          </button>
        </form>
      </aside>
    </>
  );
}
