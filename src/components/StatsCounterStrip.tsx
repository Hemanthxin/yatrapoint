"use client";

import { motion } from "framer-motion";
import { MapPin, Map, PartyPopper, LayoutGrid, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/app/CountUp";

export interface StatsCounterStripProps {
  places: number;
  states: number;
  festivals: number;
  categories: number;
}

// A premium-theme homepage staple: a row of big animated numbers backed by
// real catalogue counts (never a made-up marketing figure) — the same
// "thousands of curated places" claim the app already makes elsewhere, just
// shown as a number instead of prose.
export function StatsCounterStrip({ places, states, festivals, categories }: StatsCounterStripProps) {
  const stats: { icon: LucideIcon; value: number; format?: (n: number) => string; label: string }[] = [
    {
      icon: MapPin,
      value: places,
      format: (n) => `${(Math.floor(n / 100) * 100).toLocaleString("en-IN")}+`,
      label: "Places curated",
    },
    { icon: Map, value: states, label: "States covered" },
    { icon: PartyPopper, value: festivals, label: "Festivals tracked" },
    { icon: LayoutGrid, value: categories, label: "Trip categories" },
  ];

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      transition={{ staggerChildren: 0.1 }}
      className="relative z-10 mt-8 grid w-full grid-cols-2 gap-6 rounded-3xl border border-white/15 bg-white/[0.06] px-6 py-7 backdrop-blur-xl sm:grid-cols-4 sm:gap-4 sm:divide-x sm:divide-white/10 md:px-10"
    >
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <motion.div
            key={s.label}
            variants={{
              hidden: { opacity: 0, y: 18, scale: 0.9 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-1.5 text-center sm:px-2"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-emerald-300">
              <Icon className="h-4 w-4" />
            </span>
            <CountUp
              value={s.value}
              format={s.format}
              className="font-serif text-2xl font-bold text-white sm:text-3xl"
            />
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/60 sm:text-xs">{s.label}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
