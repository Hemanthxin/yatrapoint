"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Map, Route as RouteIcon } from "lucide-react";

// Three views of the same feature: day-trip destinations, the live Bangalore
// explorer, and the multi-stop planner. Rendered as a tab bar at the top of
// each of the three pages so they feel like one feature.
const TABS = [
  {
    href: "/one-day-trips",
    label: "Day-Trips",
    sub: "20 curated near Bangalore",
    icon: Compass,
  },
  {
    href: "/explore-bangalore",
    label: "Explore",
    sub: "All places, live OSM",
    icon: Map,
  },
  {
    href: "/budget-planner",
    label: "Plan Trip",
    sub: "Budget + categories → route",
    icon: RouteIcon,
  },
];

export function TripsTabs() {
  const path = usePathname();
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 no-scrollbar">
      {TABS.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            title={t.sub}
            className={`group flex min-h-[44px] flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold transition ${
              active
                ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${
                active ? "text-white" : "text-slate-400"
              }`}
            />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
