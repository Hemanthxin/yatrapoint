import { normalisePhone } from "@/lib/validators";
import { fail, ok, readJson } from "@/lib/cab/api";
import { getDriverVehicle, issueDriverToken, signInDriver } from "@/lib/cab/core";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await readJson<{ phone?: string; password?: string }>(req);
  const phone = normalisePhone(body?.phone ?? "");
  const password = body?.password ?? "";
  if (!phone) return fail("Enter a valid 10-digit mobile number.");
  if (!password) return fail("Enter your password.");

  const res = await signInDriver(phone, password);
  if (!res.ok) return fail(res.error, 401);

  const token = await issueDriverToken(res.driver.id);
  return ok({ token, driver: res.driver, vehicle: await getDriverVehicle(res.driver.id) });
}
