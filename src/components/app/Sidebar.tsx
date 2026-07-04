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
  { href: "/community", label: "Community", icon: Users },
  { href: "/budget-planner", label: "Budget Planner", icon: Wallet },
  { href: "/explore-bangalore", label: "Near By Places", icon: MapPin },
  { href: "/festivals", label: "Festivals & Events", icon: CalendarDays },
  { href: "/destinations", label: "State", icon: Flag },
  { href: "/profile", label: "Your Travel Places", icon: Bookmark },
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
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/50 glass-strong shadow-2xl transition-transform duration-300 ease-out lg:w-64 lg:translate-x-0 lg:shadow-none ${
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
                className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                }`}
              >
                {active && <span aria-hidden className="sheen-overlay animate-sheen" />}
                <span
                  className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${
                    active ? "bg-white/20" : "bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Promo card */}
        <div className="mx-3 mb-3 rounded-2xl bg-gradient-to-b from-emerald-50 to-teal-50 p-4 text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-white/70 text-emerald-600">
            <MapPin className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <p className="text-sm font-bold text-slate-900">Plan your trip smarter</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Get AI powered suggestions, custom itineraries and budget friendly trips.
          </p>
          <Link
            href="/budget-planner"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Explore Now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <form action={signOutAction} className="border-t border-slate-100 p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.8} /> Logout
          </button>
        </form>
      </aside>
    </>
  );
}
