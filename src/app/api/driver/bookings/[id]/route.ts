import { fail, ok, readJson } from "@/lib/cab/api";
import { driverAct, driverFromRequest, forDriver, type DriverAction } from "@/lib/cab/core";

export const runtime = "nodejs";

const ACTIONS: DriverAction[] = ["accept", "decline", "arrived", "start", "complete", "cancel"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const driver = await driverFromRequest(req);
  if (!driver) return fail("Please sign in again.", 401);

  const { id } = await params;
  const body = await readJson<{ action?: DriverAction; otp?: string }>(req);
  if (!body?.action || !ACTIONS.includes(body.action)) return fail("Unknown action.");

  const res = await driverAct(driver.id, id, body.action, body.otp);
  if (!res.ok) return fail(res.error, 409);
  return ok({ booking: forDriver(res.booking) });
}
