import { z } from "zod";
import { auth } from "@/auth";
import { fail, ok, readJson } from "@/lib/cab/api";
import { CAR_BOOKING_ENABLED } from "@/lib/cab/flags";
import { createCabBooking } from "@/lib/cab/core";

export const runtime = "nodejs";
// Looking up two addresses can take a few seconds; the default serverless limit is too tight.
export const maxDuration = 30;

const place = z.object({ lat: z.number().finite(), lng: z.number().finite(), label: z.string().max(240) });

const schema = z.object({
  vehicleId: z.string().min(5),
  pickupText: z.string().trim().min(3, "Enter the pickup location").max(240),
  dropText: z.string().trim().min(3, "Enter where you are going").max(240),
  // places the traveller confirmed in the check-price step (looked up again if absent)
  pickupPlace: place.optional().nullable(),
  dropPlace: place.optional().nullable(),
  pickupAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Choose a pickup date and time"),
  passengers: z.coerce.number().int().min(1).max(20),
  note: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  if (!CAR_BOOKING_ENABLED) return fail("Car booking is not available right now.", 503);
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return fail("Please sign in to book a car.", 401);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the booking details.");
  const d = parsed.data;

  const res = await createCabBooking({
    userId: user.id,
    userName: user.name ?? null,
    userPhone: user.phone ?? null,
    vehicleId: d.vehicleId,
    pickupText: d.pickupText,
    dropText: d.dropText,
    pickupPlace: d.pickupPlace,
    dropPlace: d.dropPlace,
    pickupAt: new Date(d.pickupAt),
    passengers: d.passengers,
    note: d.note,
  });
  if (!res.ok) return fail(res.error, 409);
  return ok({ booking: res.booking }, 201);
}
