import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession } from "@/lib/admin";
import { fetchSyncCoverage } from "@/lib/actions/admin-place-sync";
import { PlaceSyncManager } from "./PlaceSyncManager";

export default async function AdminPlaceSyncPage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");

  const coverage = await fetchSyncCoverage();
  const u = session.user;

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
          Ratings &amp; opening hours
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Syncs star ratings and live opening-hours data from Google Places into places across
          Destinations, One-day trips and City places. Every place starts unsynced — press the
          button below to sync the next batch.
        </p>
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Each sync makes real, billed Google Places API calls (one to resolve the place, one for
          its rating/hours) — nothing runs automatically. Sync a small batch first to confirm it's
          working before running larger ones.
        </p>
      </div>
      <PlaceSyncManager initialCoverage={coverage} />
    </AdminShell>
  );
}
