"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { reviewVehicle } from "@/lib/cab/core";

export async function reviewCabVehicle(vehicleId: string, approve: boolean, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return { ok: false, error: "Not authorized." };
  if (!vehicleId) return { ok: false, error: "Missing vehicle." };
  await reviewVehicle(vehicleId, approve, reason?.trim() || undefined);
  revalidatePath("/admin/drivers");
  return { ok: true };
}
