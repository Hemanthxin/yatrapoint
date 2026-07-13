import type { LucideIcon } from "lucide-react";
import { BackButton } from "@/components/app/BackButton";

// Shared layout for the static info pages (About / FAQ / Privacy / Terms) so
// they all read as one system: a gradient icon header + a clean white card.
export function InfoPage({
  icon: Icon,
  title,
  subtitle,
  updated,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fadeUp mx-auto max-w-3xl space-y-5">
      <BackButton fallback="/settings" />
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm font-medium text-slate-500">{subtitle}</p>
        </div>
      </header>

      <article className="space-y-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {children}
        {updated && (
          <p className="border-t border-slate-100 pt-4 text-xs text-slate-400">
            Last updated: {updated}
          </p>
        )}
      </article>
    </div>
  );
}

// A titled block of content.
export function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900">
        <span aria-hidden className="h-5 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-green-600" />
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

// A tidy bulleted list with emerald markers.
export function InfoList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
