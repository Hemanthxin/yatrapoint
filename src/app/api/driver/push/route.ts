import { fail, ok, readJson } from "@/lib/cab/api";
import { driverFromRequest } from "@/lib/cab/core";
import { isBrowserSubscription, pushEnabled, removePushSubscription, savePushSubscription, vapidPublicKey } from "@/lib/cab/push";

export const runtime = "nodejs";

// GET → the public key the browser needs to subscribe (null when push isn't configured).
export async function GET() {
  return ok({ enabled: pushEnabled(), publicKey: vapidPublicKey() });
}

export async function POST(req: Request) {
  const driver = await driverFromRequest(req);
  if (!driver) return fail("Please sign in again.", 401);
  const body = await readJson<{ subscription?: unknown }>(req);
  if (!isBrowserSubscription(body?.subscription)) return fail("That isn't a valid push subscription.");
  await savePushSubscription("driver", driver.id, body.subscription);
  return ok();
}

export async function DELETE(req: Request) {
  const driver = await driverFromRequest(req);
  if (!driver) return fail("Please sign in again.", 401);
  const body = await readJson<{ endpoint?: string }>(req);
  if (body?.endpoint) await removePushSubscription("driver", driver.id, body.endpoint);
  return ok();
}
