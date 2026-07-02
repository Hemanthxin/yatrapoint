"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signupSchema, classifyIdentifier, type SignupInput } from "@/lib/validators";

export interface AuthActionResult {
  ok: boolean;
  error?: string;
}

// Register a new account with name + email OR phone + password.
export async function signupAction(input: SignupInput): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const id = classifyIdentifier(parsed.data.identifier);
  if (id.type === "invalid") {
    return { ok: false, error: "Enter a valid email or 10-digit mobile number." };
  }

  try {
    // Already registered?
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(id.type === "email" ? eq(users.email, id.value) : eq(users.phone, id.value))
      .limit(1);
    if (existing[0]) {
      return {
        ok: false,
        error: `That ${id.type === "email" ? "email" : "mobile number"} is already registered — please log in.`,
      };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await db.insert(users).values({
      name: parsed.data.name.trim(),
      email: id.type === "email" ? id.value : null,
      phone: id.type === "phone" ? id.value : null,
      passwordHash,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create your account. Try a different email/number." };
  }
}
