import { verifyOtp } from "@/lib/otp/service";
import { normalisePhone } from "@/lib/validators";
import { devOtpEnabled, DEV_OTP, fail, ok, readJson } from "@/lib/cab/api";
import { findOrCreateDriver, getDriverVehicle, issueDriverToken } from "@/lib/cab/core";

export const runtime = "nodejs";

const REASONS: Record<string, string> = {
  no_code: "Ask for a new code first.",
  expired: "That code has expired. Ask for a new one.",
  too_many_attempts: "Too many wrong tries. Ask for a new code.",
  mismatch: "That code is not right.",
};

export async function POST(req: Request) {
  const body = await readJson<{ phone?: string; code?: string; name?: string }>(req);
  const phone = normalisePhone(body?.phone ?? "");
  const code = (body?.code ?? "").trim();
  if (!phone || !code) return fail("Phone and code are required.");

  const devPass = devOtpEnabled() && code === DEV_OTP;
  if (!devPass) {
    const v = await verifyOtp(phone, code);
    if (!v.ok) return fail(REASONS[v.reason] ?? "Could not verify the code.", 401);
  }

  const found = await findOrCreateDriver(phone, body?.name);
  if (!found) return ok({ needsName: true });

  const token = await issueDriverToken(found.driver.id);
  const vehicle = await getDriverVehicle(found.driver.id);
  return ok({ token, driver: found.driver, vehicle, isNew: found.isNew });
}
