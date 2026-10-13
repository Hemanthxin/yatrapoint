import { auth } from "@/auth";
import { fail, ok } from "@/lib/cab/api";
import { userBookings } from "@/lib/cab/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return fail("Please sign in.", 401);
  return ok({ bookings: await userBookings(session.user.id) });
}
