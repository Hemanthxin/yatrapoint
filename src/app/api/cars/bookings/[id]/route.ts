import { auth } from "@/auth";
import { fail, ok, readJson } from "@/lib/cab/api";
import { rateBooking, userCancel } from "@/lib/cab/core";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return fail("Please sign in.", 401);

  const body = await readJson<{ action?: string; rating?: number; review?: string }>(req);
  const { id } = await params;

  if (body?.action === "cancel") {
    const res = await userCancel(session.user.id, id);
    return res.ok ? ok() : fail(res.error, 409);
  }
  if (body?.action === "rate") {
    const res = await rateBooking(session.user.id, id, Number(body.rating), body.review);
    return res.ok ? ok() : fail(res.error, 409);
  }
  return fail("Unknown action.");
}
