import { z } from "zod";

// Indian phone: 10 digits, starts 6-9. Stored as +91XXXXXXXXXX.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/u, "Enter a valid 10-digit Indian mobile number");

export const e164PhoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/u, "Phone must be in +91XXXXXXXXXX format");

export const otpSchema = z
  .string()
  .regex(/^\d{6}$/u, "OTP must be 6 digits");

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpSchema,
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export function toE164(localPhone: string): string {
  return `+91${localPhone}`;
}

// ── Email / phone + password auth ────────────────────────────────────────────
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100, "Password is too long");

const identifierSchema = z.string().trim().min(1, "Enter your email or mobile number");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  identifier: identifierSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1, "Enter your password"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// Classify a login identifier as an email or an Indian phone (→ +91 E.164),
// or invalid. Used by both the signup action and the credentials provider.
export function classifyIdentifier(
  raw: string
): { type: "email"; value: string } | { type: "phone"; value: string } | { type: "invalid" } {
  const s = (raw ?? "").trim();
  if (s.includes("@")) {
    const email = s.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? { type: "email", value: email }
      : { type: "invalid" };
  }
  const digits = s.replace(/[\s-]/g, "");
  if (/^\+91[6-9]\d{9}$/.test(digits)) return { type: "phone", value: digits };
  if (/^[6-9]\d{9}$/.test(digits)) return { type: "phone", value: `+91${digits}` };
  return { type: "invalid" };
}
