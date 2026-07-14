import type { ComponentType } from "react";

// A shared empty-state block — illustration + title + optional description/action —
// used everywhere a list, search or cart has nothing to show yet.
export function EmptyState({
  illustration: Illustration,
  title,
  description,
  action,
  className = "",
}: {
  illustration: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`animate-fadeUp rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12 ${className}`}
    >
      <Illustration className="mx-auto h-36 w-36 sm:h-44 sm:w-44" />
      <p className="mt-4 text-base font-extrabold tracking-tight text-slate-800">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
