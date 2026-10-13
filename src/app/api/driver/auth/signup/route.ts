import { z } from "zod";
import { normalisePhone } from "@/lib/validators";
import { fail, ok, readJson } from "@/lib/cab/api";
import { getDriverVehicle, issueDriverToken, signUpDriver } from "@/lib/cab/core";

export const runtime = "nodejs";

const driverPasswordSchema = z.string().min(8, "Password must be at least 8 characters").max(100, "Password is too long");

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.string(),
  password: driverPasswordSchema,
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details.");
  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return fail("Enter a valid 10-digit mobile number.");

  const res = await signUpDriver(phone, parsed.data.name, parsed.data.password);
  if (!res.ok) return fail(res.error, 409);

  const token = await issueDriverToken(res.driver.id);
  return ok({ token, driver: res.driver, vehicle: await getDriverVehicle(res.driver.id) }, 201);
}
