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
  ImageIcon,
  CalendarClock,
  Star,
  type LucideIcon,
} from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { Reveal } from "@/components/app/Reveal";

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
  { href: "/admin/images", label: "Place Photos", icon: ImageIcon, match: "/admin/images" },
  { href: "/admin/place-sync", label: "Ratings & Hours", icon: Star, match: "/admin/place-sync" },
  { href: "/admin/festivals", label: "Festival Photos", icon: CalendarClock, match: "/admin/festivals" },
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
  if (path.startsWith("/admin/images")) return "Place Photos";
  if (path.startsWith("/admin/place-sync")) return "Ratings & Hours";
  if (path.startsWith("/admin/festivals")) return "Festival Photos";
  if (path.startsWith("/admin/dashboard")) return "Overview";
  return "Overview";
}

export function AdminShell({ adminName, adminEmail, children }: AdminShellProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const initial = adminName.charAt(0).toUpperCase();
  const title = pageTitle(path);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
      {/* Ambient indigo aurora behind the console */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-32 top-[-6rem] h-[26rem] w-[26rem] rounded-full bg-indigo-300/30 blur-3xl animate-aurora" />
        <div className="absolute right-[-8rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-300/25 blur-3xl animate-aurora [animation-delay:-10s]" />
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-900/95 text-slate-300 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out lg:w-64 lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-600/40">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">Saafera</p>
            <p className="text-xs text-slate-400">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 no-scrollbar">
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
                className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-600/40"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && <span aria-hidden className="sheen-overlay animate-sheen" />}
                <span
                  className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${
                    active ? "bg-white/20" : "bg-white/5 text-slate-400 group-hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span className="relative">{label}</span>
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
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-white/50 glass-strong px-3 shadow-[0_8px_30px_-18px_rgba(2,6,23,0.45)] sm:gap-3 sm:px-4 md:px-6">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent"
          />
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30 transition active:scale-90 lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold text-slate-500">
            Admin <span className="text-slate-300">/</span>{" "}
            <span className="text-slate-900">{title}</span>
          </p>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm shadow-indigo-500/30 sm:px-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Administrator</span>
          </span>
        </header>

        <Reveal as="main" className="mx-auto max-w-7xl px-4 py-6 pb-32 md:px-6 md:py-8 lg:pb-10" amount={0}>{children}</Reveal>
      </div>

      {/* Floating mobile dock */}
      <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-100 via-slate-100/70 to-transparent"
        />
        <nav className="relative mx-auto mb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex h-16 max-w-[20rem] animate-dockIn items-center justify-around rounded-[1.75rem] border border-white/10 bg-slate-900/90 px-3 text-slate-300 shadow-[0_18px_50px_-12px_rgba(2,6,23,0.6)] backdrop-blur-xl">
          <Link
            href="/admin/dashboard"
            className={`flex flex-1 flex-col items-center gap-1 transition ${
              path === "/admin/dashboard" ? "text-indigo-400" : "hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" strokeWidth={path === "/admin/dashboard" ? 2.5 : 1.9} />
            <span className="text-[10px] font-semibold">Overview</span>
          </Link>
          <a href="/admin/places/new" className="relative -mt-9 flex flex-col items-center">
            <span className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white ring-[5px] ring-slate-100 shadow-lg shadow-indigo-600/50 animate-glow-indigo">
              <span aria-hidden className="sheen-overlay animate-sheen" />
              <PlusCircle className="relative h-6 w-6" strokeWidth={2.2} />
            </span>
            <span className="mt-1 text-[10px] font-bold text-indigo-400">Add</span>
          </a>
          <button onClick={() => setOpen(true)} className="flex flex-1 flex-col items-center gap-1 hover:text-white">
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
