"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Film, Heart, Send } from "lucide-react";
import { getMyUnreadNotificationCount } from "@/lib/actions/notifications";
import { getMyUnreadMessageCount } from "@/lib/actions/messages";

const POLL_MS = 10000;

// Instagram's own top bar is exactly this shape — a few icons on the right
// tying the app's separate "screens" together. Community here has grown
// its own screens (Reels, Search, Messages, Notifications) beyond the main
// feed, so this small bar is the hub that links them, with live unread
// badges polled the same way `Feed.tsx` polls for new posts.
export function CommunityTopBar({ light = false }: { light?: boolean }) {
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

  return (
    <div className="flex items-center justify-end gap-1">
      <IconLink href="/community/search" label="Search" light={light}>
        <Search className="h-5 w-5" />
      </IconLink>
      <IconLink href="/community/reels" label="Reels" light={light}>
        <Film className="h-5 w-5" />
      </IconLink>
      <IconLink href="/community/notifications" label="Notifications" badge={unreadNotifs} light={light}>
        <Heart className="h-5 w-5" />
      </IconLink>
      <IconLink href="/community/messages" label="Messages" badge={unreadMsgs} light={light}>
        <Send className="h-5 w-5" />
      </IconLink>
    </div>
  );
}

function IconLink({
  href,
  label,
  badge,
  light,
  children,
}: {
  href: string;
  label: string;
  badge?: number;
  light?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`relative grid h-11 w-11 place-items-center rounded-full transition active:scale-90 ${
        light ? "text-white hover:bg-white/15" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
      {!!badge && badge > 0 && (
        <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
