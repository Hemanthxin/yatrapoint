"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { fetchHeadlines } from "@/lib/actions/announcements";

// Always-on disclaimers — shown alongside any admin headlines.
const DEFAULTS = [
  "Budget shown is approximate — not exact fares.",
  "Fuel, bus, train & flight fares are indicative and may vary.",
  "Hotel rates are sample prices and change with dates & availability.",
  "Always reconfirm timings, entry fees & routes before you travel.",
];

// A moving headline ticker at the top of the app. Admin-published news scrolls
// first, followed by the standing disclaimers.
export function Marquee() {
  const [items, setItems] = useState<string[]>(DEFAULTS);

  useEffect(() => {
    let alive = true;
    fetchHeadlines()
      .then((h) => {
        if (alive && h.length) setItems([...h, ...DEFAULTS]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Duplicate the list so the -50% translate loops seamlessly.
  const track = [...items, ...items];

  return (
    <div className="marquee-mask relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-sm">
      <div className="flex w-max animate-marquee whitespace-nowrap py-1.5 pl-28">
        {track.map((t, i) => (
          <span key={i} className="mx-5 inline-flex items-center text-xs font-medium">
            <span className="mr-2 text-amber-300">◆</span>
            {t}
          </span>
        ))}
      </div>
      {/* Fixed label that masks messages passing behind it */}
      <span className="pointer-events-none absolute left-0 top-0 z-10 flex h-full items-center gap-1.5 bg-emerald-700 px-3 text-[11px] font-extrabold uppercase tracking-wide shadow-lg">
        <Megaphone className="h-3.5 w-3.5" /> News
      </span>
      {/* Soft fade on the right edge */}
      <span className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-emerald-600 to-transparent" />
    </div>
  );
}
