import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/format";

// Budget Overview donut. We store one total budget per trip (no per-category
// split), so we break the user's real total across typical travel proportions
// to render the ring + legend. An empty total shows a neutral ring at ₹0.
// Colours follow the mockup legend: green shades for Transport/Stay/Food,
// purple for Activities, blue for Others.
const SEGMENTS = [
  { key: "Transport", ratio: 0.35, color: "#216e44" },
  { key: "Stay", ratio: 0.3, color: "#3fa06a" },
  { key: "Food", ratio: 0.2, color: "#8fd0a6" },
  { key: "Activities", ratio: 0.1, color: "#8b5cf6" },
  { key: "Others", ratio: 0.05, color: "#3b82f6" },
];

export function BudgetOverview({ total }: { total: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="card p-5">
      <p className="text-sm font-bold text-slate-900">Budget Overview</p>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
            {total > 0 &&
              SEGMENTS.map((s) => {
                const len = s.ratio * C;
                const dash = <circle
                  key={s.key}
                  cx="64"
                  cy="64"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                />;
                offset += len;
                return dash;
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black leading-none text-slate-900">{formatINR(total)}</span>
            <span className="text-[10px] font-medium text-slate-500">Total Budget</span>
          </div>
        </div>

        <ul className="flex-1 space-y-1.5">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.key}
              </span>
              <span className="font-bold text-slate-800">
                {formatINR(Math.round(total * s.ratio))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/budget-planner" className="btn-primary mt-4 w-full py-2.5 text-sm">
        Plan Budget <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
