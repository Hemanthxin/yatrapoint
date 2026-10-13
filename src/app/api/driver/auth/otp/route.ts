import { sendOtp } from "@/lib/otp/service";
import { normalisePhone } from "@/lib/validators";
import { devOtpEnabled, DEV_OTP, fail, ok, readJson } from "@/lib/cab/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await readJson<{ phone?: string }>(req);
  const phone = normalisePhone(body?.phone ?? "");
  if (!phone) return fail("Enter a valid 10-digit mobile number.");

  const sent = await sendOtp(phone);
  if (!sent.ok) return fail(`Please wait ${sent.retryAfterSeconds}s before asking for another code.`, 429);

  return ok({ phone, devHint: devOtpEnabled() ? DEV_OTP : undefined });
}
