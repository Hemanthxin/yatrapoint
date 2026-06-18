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
    <nav className="mb-5 grid gap-2 sm:grid-cols-3">
      {TABS.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`group rounded-2xl border p-3 transition ${
              active
                ? "border-emerald-500 bg-emerald-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-emerald-200 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`grid h-8 w-8 place-items-center rounded-full ${
                  active ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={`font-semibold ${
                  active ? "text-emerald-900" : "text-slate-900"
                }`}
              >
                {t.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t.sub}</p>
          </Link>
        );
      })}
    </nav>
  );
}
