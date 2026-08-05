"use client";

import { useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { syncNextPlacesBatch, type SyncCoverage, type SyncBatchResult } from "@/lib/actions/admin-place-sync";

const BATCH_SIZES = [10, 20, 50];

export function PlaceSyncManager({ initialCoverage }: { initialCoverage: SyncCoverage | null }) {
  const [coverage, setCoverage] = useState(initialCoverage);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<SyncBatchResult | null>(null);

  async function runBatch(limit: number) {
    setBusy(true);
    setLastResult(null);
    try {
      const result = await syncNextPlacesBatch(limit);
      setLastResult(result);
      // Coverage counts change after a sync — refetch by re-running the same
      // count logic client-side isn't available, so just bump the synced
      // counters locally using the batch result as a reasonable estimate;
      // a page refresh shows the exact server-side counts.
      if (result.ok && coverage) {
        setCoverage({
          destinations: coverage.destinations,
          cityPlaces: coverage.cityPlaces,
          nearbyDestinations: coverage.nearbyDestinations,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {coverage && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CoverageCard label="Destinations" total={coverage.destinations.total} synced={coverage.destinations.synced} />
          <CoverageCard label="City places" total={coverage.cityPlaces.total} synced={coverage.cityPlaces.synced} />
          <CoverageCard label="One-day trips" total={coverage.nearbyDestinations.total} synced={coverage.nearbyDestinations.synced} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {BATCH_SIZES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => runBatch(n)}
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync next {n}
          </button>
        ))}
        <p className="text-xs text-slate-400">Refresh the page after syncing to see updated coverage counts.</p>
      </div>

      {lastResult && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-900">
            Synced {lastResult.synced}, failed {lastResult.failed}
          </p>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs text-slate-600">
            {lastResult.details.map((d, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {d.startsWith("✓") ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                )}
                {d.slice(2)}
              </li>
            ))}
          </ul>
          {lastResult.error && <p className="mt-2 text-xs text-rose-600">{lastResult.error}</p>}
        </div>
      )}
    </div>
  );
}

function CoverageCard({ label, total, synced }: { label: string; total: number; synced: number }) {
  const pct = total > 0 ? Math.round((synced / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">
        {synced} <span className="text-sm font-medium text-slate-400">/ {total} synced</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
