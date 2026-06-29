"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  MapPinned,
  PlusCircle,
  Globe,
  LogOut,
  Menu,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string;
}

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard, match: "/admin/dashboard" },
  { href: "/admin/places", label: "Places", icon: MapPinned, match: "/admin/places" },
  { href: "/admin/places/new", label: "Add Place", icon: PlusCircle, match: "/admin/places/new" },
  { href: "/dashboard", label: "Public Site", icon: Globe },
];

interface AdminShellProps {
  adminName: string;
  adminEmail?: string | null;
  children: React.ReactNode;
}

// Human label for the current admin route — shown in the top breadcrumb.
function pageTitle(path: string): string {
  if (path.startsWith("/admin/places/new")) return "Add Place";
  if (/^\/admin\/places\/.+\/edit/.test(path)) return "Edit Place";
  if (path.startsWith("/admin/places")) return "Places";
  if (path.startsWith("/admin/dashboard")) return "Overview";
  return "Overview";
}

export function AdminShell({ adminName, adminEmail, children }: AdminShellProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const initial = adminName.charAt(0).toUpperCase();
  const title = pageTitle(path);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">Explore World</p>
            <p className="text-xs text-slate-400">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </p>
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = !!match && path === match;
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-2.5 px-2 py-1">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{adminName}</p>
              <p className="truncate text-xs text-slate-400">{adminEmail ?? "Administrator"}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-rose-500/15 hover:text-rose-300"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.8} /> Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur-md sm:gap-3 sm:px-4 md:px-6">
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold text-slate-500">
            Admin <span className="text-slate-300">/</span>{" "}
            <span className="text-slate-900">{title}</span>
          </p>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 sm:px-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Administrator</span>
          </span>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2 text-slate-300">
          <Link
            href="/admin/dashboard"
            className={`flex flex-1 flex-col items-center gap-0.5 ${
              path === "/admin/dashboard" ? "text-indigo-400" : "hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[11px] font-medium">Overview</span>
          </Link>
          <a href="/admin/places/new" className="relative -mt-7 flex flex-col items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 ring-4 ring-slate-900">
              <PlusCircle className="h-6 w-6" />
            </span>
            <span className="mt-1 text-[11px] font-semibold text-indigo-400">Add</span>
          </a>
          <button onClick={() => setOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 hover:text-white">
            <Menu className="h-5 w-5" />
            <span className="text-[11px] font-medium">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
