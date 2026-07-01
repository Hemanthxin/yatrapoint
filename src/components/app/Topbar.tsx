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
  ShoppingBag,
  Trash2,
  ArrowRight,
} from "lucide-react";

import { useLocation } from "@/components/app/LocationContext";
import { signOutAction } from "@/lib/actions/auth";
import { useCart, removeFromCart, clearCart } from "@/lib/cart";

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
  const [openCart, setOpenCart] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const cart = useCart();

  // Close dropdowns on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setOpenNotif(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setOpenUser(false);
      if (cartRef.current && !cartRef.current.contains(e.target as Node)) setOpenCart(false);
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
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2.5 border-b border-white/50 glass-strong px-4 shadow-[0_8px_30px_-18px_rgba(2,6,23,0.45)] md:gap-3 md:px-6">
      {/* Gradient hairline under the bar for a premium edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
      />

      <button
        onClick={onMenu}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 transition active:scale-90 lg:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={onSearch} className="group relative flex-1 lg:max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-emerald-600" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Where to next?"
          className="w-full rounded-full border border-slate-200/80 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-slate-700 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
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

        {/* Trip cart */}
        <div className="relative" ref={cartRef}>
          <button
            onClick={() => {
              setOpenCart((v) => !v);
              setOpenNotif(false);
              setOpenUser(false);
            }}
            className="relative grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-white/70 active:scale-90"
            aria-label="Trip cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {cart.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {cart.length}
              </span>
            )}
          </button>
          {openCart && (
            <div className="absolute right-0 mt-2 w-80 origin-top-right animate-slideDown overflow-hidden rounded-2xl border border-white/60 glass-strong shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <p className="text-sm font-bold text-slate-900">Trip cart ({cart.length})</p>
                {cart.length > 0 && (
                  <button onClick={() => clearCart()} className="text-xs font-semibold text-rose-600 hover:underline">
                    Clear
                  </button>
                )}
              </div>
              {cart.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-2xl">🧺</p>
                  <p className="mt-1 text-sm text-slate-500">Your trip cart is empty.</p>
                  <p className="mt-0.5 text-xs text-slate-400">Tap “Add to trip” on any place or festival.</p>
                </div>
              ) : (
                <>
                  <ul className="max-h-72 overflow-y-auto no-scrollbar">
                    {cart.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 px-3 py-2 hover:bg-white/60">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-base">
                          {it.emoji ?? "📍"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{it.name}</p>
                          {it.subtitle && <p className="truncate text-xs text-slate-500">{it.subtitle}</p>}
                        </div>
                        <button
                          onClick={() => removeFromCart(it.id)}
                          aria-label="Remove"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-slate-100 p-2">
                    <Link
                      href="/trip-cart"
                      onClick={() => setOpenCart(false)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/30 transition hover:scale-[1.01] active:scale-95"
                    >
                      Plan these trips <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setOpenNotif((v) => !v);
              setOpenUser(false);
            }}
            className="relative grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-white/70 active:scale-90"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400" />
            </span>
          </button>
          {openNotif && (
            <div className="absolute right-0 mt-2 w-72 origin-top-right animate-slideDown overflow-hidden rounded-2xl border border-white/60 glass-strong shadow-xl">
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
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-white/70 active:scale-95"
          >
            <span className="grid place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 p-[2px] shadow-sm shadow-emerald-500/40">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userImage} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-bold text-emerald-700">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="hidden text-sm font-semibold text-slate-700 sm:inline">Hi, {firstName}</span>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:inline" />
          </button>
          {openUser && (
            <div className="absolute right-0 mt-2 w-48 origin-top-right animate-slideDown overflow-hidden rounded-2xl border border-white/60 glass-strong shadow-xl">
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
