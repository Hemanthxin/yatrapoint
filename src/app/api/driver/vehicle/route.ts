import { z } from "zod";
import { fail, ok, readJson } from "@/lib/cab/api";
import { driverFromRequest, saveDriverVehicle, VEHICLE_TYPES } from "@/lib/cab/core";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(VEHICLE_TYPES),
  makeModel: z.string().trim().min(2, "Enter the vehicle make and model").max(80),
  colour: z.string().trim().max(30).optional().nullable(),
  plate: z
    .string()
    .trim()
    .min(6, "Enter the number plate")
    .max(14)
    .regex(/^[A-Za-z0-9 -]+$/, "Number plate has invalid characters"),
  year: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1).optional().nullable(),
  seats: z.coerce.number().int().min(1).max(20),
  ac: z.boolean(),
  city: z.string().trim().min(2, "Enter your city").max(60),
  ratePerKm: z.coerce.number().int().min(5, "Rate per km must be at least ₹5").max(200),
  baseFare: z.coerce.number().int().min(0).max(5000),
  rcNo: z.string().trim().max(40).optional().nullable(),
  licenceNo: z.string().trim().max(40).optional().nullable(),
  // A small data-URL photo (the app resizes it before sending).
  photoUrl: z.string().max(400_000).startsWith("data:image/").optional().nullable(),
});

export async function POST(req: Request) {
  const driver = await driverFromRequest(req);
  if (!driver) return fail("Please sign in again.", 401);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the vehicle details.");

  const res = await saveDriverVehicle(driver.id, parsed.data);
  if (!res.ok) return fail(res.error, 409);
  return ok({ vehicle: res.vehicle });
}
