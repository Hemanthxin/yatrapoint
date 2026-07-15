import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}

// Simple prev/next pager, link-based (no client JS) so it fits the rest of
// this page's server-rendered, searchParams-driven navigation.
export function Pagination({ page, totalPages, makeHref }: Props) {
  if (totalPages <= 1) return null;
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      {prev ? (
        <Link
          href={makeHref(prev)}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Link>
      ) : (
        <span className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-300">
          <ChevronLeft className="h-4 w-4" /> Prev
        </span>
      )}
      <span className="px-2 text-sm font-semibold text-slate-500">
        Page {page} of {totalPages}
      </span>
      {next ? (
        <Link
          href={makeHref(next)}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-300">
          Next <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
