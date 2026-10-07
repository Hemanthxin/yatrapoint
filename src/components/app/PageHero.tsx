import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/app/Reveal";
import { MountainScape, type ScapeLayer } from "@/components/storybook/MountainScape";

interface PageHeroProps {
  /** Small kicker above the headline, e.g. "Explore India". */
  eyebrow?: string;
  /** Main headline — pass a fragment for a two-tone/serif-accented title. */
  title: ReactNode;
  subtitle?: string;
  icon?: LucideIcon;
  /** Quick stat pills shown under the subtitle, e.g. {label:"Places", value:"1,300+"}. */
  stats?: { label: string; value: string }[];
  /** Legacy Tailwind gradient prop — kept so existing call sites compile; the banner is now a painted scene. */
  gradient?: string;
  /** Optional photo behind the banner, in place of the painted sky — a dark scrim is added so the title stays readable. */
  backgroundImage?: string;
  /** Optional CTA / controls slot, right-aligned on wide screens. */
  action?: ReactNode;
  className?: string;
}

// Short, wide banner: the viewBox is sliced from the bottom, so ridges sit low
// (base ≥ 700) and the tallest peaks are allowed to be cropped by the frame.
const DAY: ScapeLayer[] = [
  { color: "#dcc4f2", fade: "#ffe6cc", shade: "#bb98e0", base: 730, amp: 220, peaks: 5, snow: true },
  { color: "#9fc0f2", fade: "#e4eed8", shade: "#7da2e0", base: 790, amp: 170, peaks: 6 },
  { color: "#4fc08a", fade: "#c4ecaa", shade: "#2f9f6c", base: 860, amp: 120, peaks: 8, trees: "pine", treeColor: "#2a9a66", treeCount: 60, treeSize: [24, 46] },
];
const NIGHT: ScapeLayer[] = [
  { color: "#424a86", fade: "#262b5c", shade: "#2f3670", base: 730, amp: 220, peaks: 5, snow: true },
  { color: "#313868", fade: "#1c2148", shade: "#242a58", base: 790, amp: 170, peaks: 6 },
  { color: "#222952", fade: "#141935", shade: "#181e40", base: 860, amp: 120, peaks: 8, trees: "pine", treeColor: "#141a38", treeCount: 60, treeSize: [24, 46] },
];

// Desktop-only painted banner — a small illustrated scene (sky, sun/moon,
// three watercolour ridges) with the page title lettered over it. Never
// rendered on mobile: it's only ever imported from a page's desktop branch.
export function PageHero({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  stats,
  backgroundImage,
  action,
  className = "",
}: PageHeroProps) {
  return (
    <Reveal
      amount={0}
      y={16}
      className={`sb-hero relative mb-10 overflow-hidden rounded-[2rem] px-10 py-12 ${
        backgroundImage ? "sb-hero--photo text-white" : ""
      } ${className}`}
    >
      {backgroundImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
        </>
      ) : (
        <div aria-hidden className="sb-hero-sky">
          <span className="sb-hero-orb" />
          <div className="absolute inset-x-0 top-0 -bottom-[14%]" data-sb-parallax="0.1">
            <MountainScape layers={DAY} idPrefix="ph-day" seed={3} className="sb-only-day" />
            <MountainScape layers={NIGHT} idPrefix="ph-night" seed={3} className="sb-only-night" />
          </div>
        </div>
      )}

      <div className="relative flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-2xl">
          {(eyebrow || Icon) && (
            <div className="mb-4 flex items-center gap-2.5">
              {Icon && (
                <span className="sb-hero-icon grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              {eyebrow && <span className="sb-eyebrow text-sm font-semibold">{eyebrow}</span>}
            </div>
          )}
          <h1 className="sb-hero-title font-serif text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
            {title}
          </h1>
          {subtitle && <p className="sb-hero-sub mt-4 max-w-xl text-lg font-medium leading-relaxed">{subtitle}</p>}
          {stats && stats.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="sb-hero-title font-serif text-3xl font-semibold leading-none">{s.value}</p>
                  <p className="sb-hero-sub mt-1.5 text-xs font-bold uppercase tracking-wide opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </Reveal>
  );
}
