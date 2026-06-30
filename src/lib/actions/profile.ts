"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const profileSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(255)
    .optional()
    .or(z.literal("")),
  // Instagram-style handle: 3–30 of letters / numbers / . / _
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._]{3,30}$/, "3–30 letters, numbers, . or _")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(300, "Bio is too long (max 300)").optional().or(z.literal("")),
  // Resized data URL (or remote URL). Validated for size below.
  image: z.string().optional().or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof profileSchema>;

export async function updateProfile(input: UpdateProfileInput) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Not signed in" };
  }
  const uid = session.user.id;

  const name = parsed.data.name?.trim() || null;
  const email = parsed.data.email?.trim() || null;
  const username = parsed.data.username?.trim() || null;
  const bio = parsed.data.bio?.trim() || null;
  const image = parsed.data.image;

  // Avatars are stored inline as data URLs — keep them small.
  if (image && image.length > 2_500_000) {
    return { ok: false as const, error: "Photo is too large — try a smaller one." };
  }

  // Enforce a unique handle (case-insensitive), ignoring this user's own row.
  if (username) {
    const clash = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.username}) = ${username.toLowerCase()}`, ne(users.id, uid)))
      .limit(1);
    if (clash.length > 0) {
      return { ok: false as const, error: "That username is taken — pick another." };
    }
  }

  try {
    await db
      .update(users)
      .set({
        name,
        email,
        username,
        bio,
        // Only overwrite the avatar when a non-empty value is provided, so a
        // plain profile save never wipes the existing picture.
        ...(image !== undefined && image !== "" ? { image } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, uid));
  } catch {
    return { ok: false as const, error: "Could not save — that email or username may already be in use." };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/community");
  return { ok: true as const };
}
