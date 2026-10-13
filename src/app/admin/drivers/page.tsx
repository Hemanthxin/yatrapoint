import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession } from "@/lib/admin";
import { listVehiclesForAdmin } from "@/lib/cab/core";
import { VehicleReviewList } from "./VehicleReviewList";

export const dynamic = "force-dynamic";

export default async function AdminDriversPage() {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");
  const u = session.user;

  const vehicles = await listVehiclesForAdmin();
  const pending = vehicles.filter((v) => v.status === "pending").length;

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Cab drivers &amp; vehicles</h1>
        <p className="mt-1 text-sm text-slate-500">
          Drivers register a vehicle in the Saafera Captain driver app (saafera-captain.vercel.app). Check the licence and RC details, then approve it — only approved vehicles are shown to travellers on the Book a car page.
        </p>
        <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{pending} waiting for review</p>
      </div>
      <VehicleReviewList vehicles={JSON.parse(JSON.stringify(vehicles))} />
    </AdminShell>
  );
}
