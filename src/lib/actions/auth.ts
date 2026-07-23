"use server";

import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// Permanently deletes the signed-in user's account. Every other table that
// references users (accounts, sessions, favorites, trip plans + their items,
// community posts/comments/reactions) has an `onDelete: "cascade"` foreign
// key, so removing the `users` row cleans up everything in one statement —
// see src/lib/db/schema.ts.
export async function deleteAccountAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Not signed in" };
  }

  await db.delete(users).where(eq(users.id, session.user.id));

  // Clear the session cookie and send the (now-deleted) user to the
  // logged-out landing page.
  await signOut({ redirectTo: "/" });
}
