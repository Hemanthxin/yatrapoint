"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signupSchema, normalisePhone, type SignupInput } from "@/lib/validators";

export interface AuthActionResult {
  ok: boolean;
  error?: string;
}

// Register a new account with name + mobile number + password.
export async function signupAction(input: SignupInput): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) {
    return { ok: false, error: "Enter a valid 10-digit Indian mobile number." };
  }

  try {
    // Already registered?
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    if (existing[0]) {
      return {
        ok: false,
        error: "That mobile number is already registered — please log in.",
      };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await db.insert(users).values({
      name: parsed.data.name.trim(),
      phone,
      passwordHash,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create your account. Try a different number." };
  }
}
