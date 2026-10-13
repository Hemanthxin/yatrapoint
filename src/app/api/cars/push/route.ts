import { auth } from "@/auth";
import { fail, ok, readJson } from "@/lib/cab/api";
import { isBrowserSubscription, pushEnabled, removePushSubscription, savePushSubscription, vapidPublicKey } from "@/lib/cab/push";

export const runtime = "nodejs";

export async function GET() {
  return ok({ enabled: pushEnabled(), publicKey: vapidPublicKey() });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("Please sign in.", 401);
  const body = await readJson<{ subscription?: unknown }>(req);
  if (!isBrowserSubscription(body?.subscription)) return fail("That isn't a valid push subscription.");
  await savePushSubscription("user", session.user.id, body.subscription);
  return ok();
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail("Please sign in.", 401);
  const body = await readJson<{ endpoint?: string }>(req);
  if (body?.endpoint) await removePushSubscription("user", session.user.id, body.endpoint);
  return ok();
}
