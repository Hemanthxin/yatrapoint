"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { resetDriverPassword, reviewVehicle } from "@/lib/cab/core";

/** Sets a new temporary password for a driver and returns it once, for the admin to pass on. */
export async function resetCabDriverPassword(driverId: string): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return { ok: false, error: "Not authorized." };
  if (!driverId) return { ok: false, error: "Missing driver." };
  const res = await resetDriverPassword(driverId);
  if (res.ok) revalidatePath("/admin/drivers");
  return res;
}

export async function reviewCabVehicle(vehicleId: string, approve: boolean, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return { ok: false, error: "Not authorized." };
  if (!vehicleId) return { ok: false, error: "Missing vehicle." };
  await reviewVehicle(vehicleId, approve, reason?.trim() || undefined);
  revalidatePath("/admin/drivers");
  return { ok: true };
}
