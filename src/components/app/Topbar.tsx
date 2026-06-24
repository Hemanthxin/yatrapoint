"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Menu,
  Search,
  MapPin,
  Bell,
  ChevronDown,
  User,
  Briefcase,
  LogOut,
  Loader2,
} from "lucide-react";

import { useLocation } from "@/components/app/LocationContext";
import { signOutAction } from "@/lib/actions/auth";

interface TopbarProps {
  userLabel: string;
  userImage?: string | null;
  location?: string;
  onMenu: () => void;
}

const NOTIFICATIONS = [
  { title: "Your Coorg trip is coming up", time: "2h", href: "/one-day-trips" },
  { title: "New hidden place published near you", time: "5h", href: "/community" },
  { title: "Festival season starts this month", time: "1d", href: "/festivals" },
];

export function Topbar({ userLabel, userImage, location = "Bengaluru, India", onMenu }: TopbarProps) {
  const router = useRouter();
  const { status, isFallback, request } = useLocation();
  const firstName = userLabel.split(" ")[0] || userLabel;

  const [query, setQuery] = useState("");
  const [openNotif, setOpenNotif] = useState(false);
  const [openUser, setOpenUser] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setOpenNotif(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setOpenUser(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/destinations?q=${encodeURIComponent(q)}` : "/destinations");
  }

  const locationLabel =
    status === "prompting"
      ? "Locating…"
      : status === "granted" && !isFallback
      ? "Your location"
      : location;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md md:px-6">
      <button
        onClick={onMenu}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={onSearch} className="relative flex-1 lg:max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Explore more places..."
          className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
        />
      </form>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {/* Location */}
        <button
          onClick={() => request()}
          title="Use my live location"
          className="hidden items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:flex"
        >
          {status === "prompting" ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          ) : (
            <MapPin className={`h-4 w-4 ${isFallback ? "text-slate-400" : "text-emerald-600"}`} />
          )}
          {locationLabel}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setOpenNotif((v) => !v);
              setOpenUser(false);
            }}
            className="relative grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </button>
          {openNotif && (
            <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <p className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">
                Notifications
              </p>
              <ul>
                {NOTIFICATIONS.map((n) => (
                  <li key={n.title}>
                    <Link
                      href={n.href}
                      onClick={() => setOpenNotif(false)}
                      className="flex items-start gap-2 px-4 py-3 text-sm hover:bg-slate-50"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span className="flex-1 text-slate-700">{n.title}</span>
                      <span className="text-xs text-slate-400">{n.time}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => {
              setOpenUser((v) => !v);
              setOpenNotif(false);
            }}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100"
          >
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden text-sm font-semibold text-slate-700 sm:inline">Hi, {firstName}</span>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:inline" />
          </button>
          {openUser && (
            <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <Link
                href="/profile"
                onClick={() => setOpenUser(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <User className="h-4 w-4 text-slate-400" /> Profile
              </Link>
              <Link
                href="/one-day-trips"
                onClick={() => setOpenUser(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Briefcase className="h-4 w-4 text-slate-400" /> My Trips
              </Link>
              <form action={signOutAction} className="border-t border-slate-100">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
