import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/app/Reveal";

interface PageHeroProps {
  /** Small uppercase kicker above the headline, e.g. "Explore India". */
  eyebrow?: string;
  /** Main headline — pass a fragment for a two-tone/serif-accented title. */
  title: ReactNode;
  subtitle?: string;
  icon?: LucideIcon;
  /** Quick stat pills shown under the subtitle, e.g. {label:"Places", value:"1,300+"}. */
  stats?: { label: string; value: string }[];
  /** Tailwind gradient stops for the banner background. */
  gradient?: string;
  /** Optional CTA / controls slot, right-aligned on wide screens. */
  action?: ReactNode;
  className?: string;
}

// Desktop-only editorial banner — big serif headline over a full-width
// gradient field, used in place of the old compact icon+title header on the
// large-screen variant of each section page. Never rendered on mobile: it's
// only ever imported from a page's `hidden lg:block` desktop branch.
export function PageHero({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  stats,
  gradient = "from-emerald-700 via-emerald-600 to-teal-700",
  action,
  className = "",
}: PageHeroProps) {
  return (
    <Reveal amount={0} y={16} className={`relative mb-10 overflow-hidden rounded-[2rem] bg-gradient-to-br ${gradient} px-10 py-12 text-white shadow-xl shadow-emerald-900/15 ${className}`}>
      {/* Soft decorative texture */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.14]">
        <div className="absolute -left-16 -top-24 h-72 w-72 rounded-full bg-white blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-white blur-3xl" />
      </div>
      <div aria-hidden className="sheen-overlay animate-sheen" />

      <div className="relative flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-2xl">
          {(eyebrow || Icon) && (
            <div className="mb-4 flex items-center gap-2.5">
              {Icon && (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              {eyebrow && (
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{eyebrow}</span>
              )}
            </div>
          )}
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 max-w-xl text-lg font-medium leading-relaxed text-white/85">{subtitle}</p>
          )}
          {stats && stats.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="font-serif text-3xl font-semibold leading-none">{s.value}</p>
                  <p className="mt-1.5 text-xs font-bold uppercase tracking-wide text-white/70">{s.label}</p>
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
