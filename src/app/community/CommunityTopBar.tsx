"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Film, Heart, Send, type LucideIcon } from "lucide-react";
import { getMyUnreadNotificationCount } from "@/lib/actions/notifications";
import { getMyUnreadMessageCount } from "@/lib/actions/messages";

const POLL_MS = 10000;

const LINKS: { href: string; label: string; icon: LucideIcon; badgeKey?: "notifs" | "msgs" }[] = [
  { href: "/community/search", label: "Search", icon: Search },
  { href: "/community/reels", label: "Reels", icon: Film },
  { href: "/community/notifications", label: "Notifications", icon: Heart, badgeKey: "notifs" },
  { href: "/community/messages", label: "Messages", icon: Send, badgeKey: "msgs" },
];

// Instagram's own top bar is exactly this shape — a few icons tying the
// app's separate "screens" together. Community here has grown its own
// screens (Reels, Search, Messages, Notifications) beyond the main feed, so
// this bar is the hub that links them, with live unread badges polled the
// same way `Feed.tsx` polls for new posts.
//
// `variant="icons"` is the compact row used in the mobile app-bar and inside
// the desktop PageHero; `variant="rail"` is a labeled vertical nav list for
// the desktop right rail, styled like `Sidebar.tsx`'s own nav items.
export function CommunityTopBar({ variant = "icons" }: { variant?: "icons" | "rail" }) {
  const pathname = usePathname();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const [n, m] = await Promise.all([getMyUnreadNotificationCount(), getMyUnreadMessageCount()]);
      if (!cancelled) {
        setUnreadNotifs(n);
        setUnreadMsgs(m);
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const badgeFor = (key?: "notifs" | "msgs") => (key === "notifs" ? unreadNotifs : key === "msgs" ? unreadMsgs : 0);

  if (variant === "rail") {
    return (
      <nav className="space-y-0.5">
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname?.startsWith(l.href + "/");
          const Icon = l.icon;
          const badge = badgeFor(l.badgeKey);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-[color:var(--surface-2)] font-semibold text-[color:var(--accent)]"
                  : "font-medium text-[color:var(--text-soft)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
              }`}
            >
              <span
                aria-hidden
                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[color:var(--accent)] transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition ${
                  active ? "text-[color:var(--accent)]" : "text-[color:var(--muted)] group-hover:text-[color:var(--text)]"
                }`}
                strokeWidth={2}
              />
              <span className="flex-1">{l.label}</span>
              {badge > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {LINKS.map((l) => {
        const Icon = l.icon;
        const badge = badgeFor(l.badgeKey);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-label={l.label}
            className="relative grid h-10 w-10 place-items-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-2)] active:scale-90"
          >
            <Icon className="h-5 w-5" />
            {badge > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[color:var(--surface)]">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
