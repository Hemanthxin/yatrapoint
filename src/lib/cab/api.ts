import { NextResponse } from "next/server";

export const noStore = { "Cache-Control": "no-store" };

export function ok(data: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status, headers: noStore });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status, headers: noStore });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** The OTP provider is "mock" in development, so the code is only in the server log.
 *  In that mode (never in production) 123456 is accepted so the flow can be tried. */
export const DEV_OTP = "123456";
export const devOtpEnabled = () => process.env.NODE_ENV !== "production" && (process.env.OTP_PROVIDER ?? "mock") === "mock";
