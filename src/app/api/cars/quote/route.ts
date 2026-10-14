import { z } from "zod";
import { auth } from "@/auth";
import { fail, ok, readJson } from "@/lib/cab/api";
import { CAR_BOOKING_ENABLED } from "@/lib/cab/flags";
import { quoteCabTrip } from "@/lib/cab/core";

export const runtime = "nodejs";
// Looking up two addresses can take a few seconds; the default serverless limit is too tight.
export const maxDuration = 30;

const schema = z.object({
  vehicleId: z.string().min(5),
  pickupText: z.string().trim().min(3, "Enter the pickup location").max(240),
  dropText: z.string().trim().min(3, "Enter where you are going").max(240),
});

// The "check price" step: finds the two places and works out distance and fare, without
// creating a booking, so the traveller can see what we understood before sending it.
export async function POST(req: Request) {
  if (!CAR_BOOKING_ENABLED) return fail("Car booking is not available right now.", 503);
  const session = await auth();
  if (!session?.user?.id) return fail("Please sign in to book a car.", 401);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const res = await quoteCabTrip(parsed.data.vehicleId, parsed.data.pickupText, parsed.data.dropText);
  if (!res.ok) return fail(res.error, 409);
  return ok({ quote: { pickup: res.pickup, drop: res.drop, distanceKm: res.distanceKm, fare: res.fare } });
}
