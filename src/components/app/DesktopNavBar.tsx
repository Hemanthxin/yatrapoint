"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Wallet,
  MapPin,
  CalendarDays,
  Flag,
  Bookmark,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Same destinations as the mobile drawer's Sidebar nav, laid out horizontally
// instead of as a permanent left column — the classic WordPress/marketing-site
// top nav instead of an app-style sidebar. Desktop (lg+) only; mobile keeps
// its own off-canvas Sidebar drawer completely untouched.
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/destinations", label: "Tourist Places", icon: Flag },
  { href: "/budget-planner", label: "Trip Planner", icon: Wallet },
  { href: "/explore-bangalore", label: "Near By Places", icon: MapPin },
  { href: "/community", label: "Community", icon: Users },
  { href: "/festivals", label: "Festivals", icon: CalendarDays },
  { href: "/profile", label: "Your Places", icon: Bookmark },
];

export function DesktopNavBar() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-30 hidden border-b border-[color:var(--border)] glass-strong lg:block">
      <div className="mx-auto flex h-[4.25rem] max-w-[1800px] items-center gap-8 px-8 2xl:px-10">
        <Link href="/dashboard" aria-label="Saafera — home" className="shrink-0">
          <Image
            src="/saafera-logo.jpg"
            alt="Saafera"
            width={280}
            height={280}
            priority
            className="app-logo h-auto w-[120px] object-contain"
          />
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? "text-[color:var(--accent)]"
                    : "text-[color:var(--text-soft)] hover:text-[color:var(--text)]"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-[color:var(--accent)]" : "text-[color:var(--muted)] group-hover:text-[color:var(--text)]"}`} strokeWidth={2} />
                {label}
                {/* Underline accent on the active item — the marketing-nav tell. */}
                <span
                  aria-hidden
                  className={`absolute inset-x-3.5 -bottom-[1.05rem] h-[2.5px] rounded-full bg-[color:var(--accent)] transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <Link
          href="/budget-planner"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/30 transition hover:scale-[1.03] active:scale-95"
        >
          Plan a trip <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
