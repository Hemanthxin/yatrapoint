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

// ── Phone + password auth ────────────────────────────────────────────────────
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100, "Password is too long");

// Sign up with name, 10-digit Indian mobile, password + confirm password.
export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(120),
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Log in with 10-digit Indian mobile + password.
export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Enter your password"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// Normalise a raw mobile input to +91 E.164, or null when it isn't a valid
// 10-digit Indian mobile. Used by the signup action and credentials provider.
export function normalisePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/[\s-]/g, "");
  if (/^\+91[6-9]\d{9}$/.test(digits)) return digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  return null;
}
