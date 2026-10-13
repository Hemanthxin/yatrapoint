import { fail, ok, readJson } from "@/lib/cab/api";
import { driverFromRequest, getDriverVehicle, setAvailability } from "@/lib/cab/core";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const driver = await driverFromRequest(req);
  if (!driver) return fail("Please sign in again.", 401);

  const body = await readJson<{ available?: boolean }>(req);
  const vehicle = await getDriverVehicle(driver.id);
  if (!vehicle) return fail("Register your vehicle first.");
  if (vehicle.status !== "approved") return fail("Your vehicle is not approved yet.", 403);

  const updated = await setAvailability(driver.id, !!body?.available);
  return ok({ vehicle: updated });
}
