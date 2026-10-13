import { fail, ok } from "@/lib/cab/api";
import { driverFromRequest, markNotificationsRead } from "@/lib/cab/core";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const driver = await driverFromRequest(req);
  if (!driver) return fail("Please sign in again.", 401);
  await markNotificationsRead(driver.id);
  return ok();
}
