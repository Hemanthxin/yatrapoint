"use client";

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import { upcomingFestivals, formatFestivalDate, daysUntil, type Festival } from "@/lib/festivals";

// A moving footer ticker of upcoming festivals — the nearest festival leads, and
// as each date passes it drops off so the next one takes the front. Computed on
// the client so it reflects the real current date (and avoids SSR mismatch).
export function FestivalTicker() {
  const [items, setItems] = useState<Festival[]>([]);

  useEffect(() => {
    setItems(upcomingFestivals());
  }, []);

  if (items.length === 0) return null;

  const line = (f: Festival) => {
    const d = daysUntil(f.dateISO);
    const when =
      d === 0 ? "Today" : d === 1 ? "Tomorrow" : d && d > 0 ? `in ${d} days` : formatFestivalDate(f.dateISO);
    return `${f.emoji}  ${f.name} · ${formatFestivalDate(f.dateISO)} (${when})${f.hub ? ` · ${f.hub}` : ""}${
      f.significance ? ` — ${f.significance}` : ""
    }`;
  };

  const track = [...items, ...items]; // duplicate for a seamless loop
  // Slow, readable pace — matches the top news ticker (~11s per item).
  const durationSec = Math.max(55, items.length * 11);

  return (
    <div className="bleed mt-8">
      <div className="marquee-mask relative overflow-hidden bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-sm">
        <div
          className="flex w-max animate-marquee whitespace-nowrap py-1.5 pl-32"
          style={{ animationDuration: `${durationSec}s` }}
        >
          {track.map((f, i) => (
            <span key={i} className="mx-6 inline-flex items-center text-xs font-medium">
              {line(f)}
            </span>
          ))}
        </div>
        {/* Fixed label masking messages behind it */}
        <span className="pointer-events-none absolute left-0 top-0 z-10 flex h-full items-center gap-1.5 bg-red-800 px-3 text-[11px] font-extrabold uppercase tracking-wide shadow-lg">
          <PartyPopper className="h-3.5 w-3.5" /> Festivals
        </span>
        <span className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-red-700 to-transparent" />
      </div>
    </div>
  );
}
