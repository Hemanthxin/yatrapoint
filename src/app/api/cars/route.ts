import { ok } from "@/lib/cab/api";
import { listBookableVehicles } from "@/lib/cab/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vehicles a traveller can book right now: approved by admin and the driver is
// taking bookings. Driver phone numbers are deliberately not exposed here.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const vehicles = await listBookableVehicles({ type: url.searchParams.get("type") ?? undefined, city: url.searchParams.get("city") ?? undefined });
  return ok({ vehicles });
}
