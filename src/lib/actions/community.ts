"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { communityPosts } from "@/lib/db/schema";
import { isAdmin } from "@/lib/admin";

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

// A user submits a hidden place. It is held as "pending" until an admin
// verifies it (Module 4: Upload Photo → Live Location → Description → Admin
// Verification → Publish).
export async function submitCommunityPost(input: {
  title: string;
  description: string;
  photoUrl?: string;
  latitude?: string;
  longitude?: string;
  locationName?: string;
}): Promise<SubmitResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in first." };

  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title || title.length < 3) return { ok: false, error: "Add a short title." };
  if (!description || description.length < 10)
    return { ok: false, error: "Add a description (at least 10 characters)." };
  // Guard against oversized data-URL photos (≈1.5 MB of base64).
  if (input.photoUrl && input.photoUrl.length > 2_000_000)
    return { ok: false, error: "Photo is too large — keep it under ~1.5 MB." };

  try {
    await db.insert(communityPosts).values({
      userId: session.user.id,
      authorName: session.user.name || session.user.email || "Traveller",
      title,
      description,
      photoUrl: input.photoUrl || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      locationName: input.locationName || null,
      status: "pending",
    });
    revalidatePath("/community");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save — is the database set up? Run db:push." };
  }
}

async function requireAdmin() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) throw new Error("Not authorised");
}

export async function approveCommunityPost(id: string) {
  await requireAdmin();
  await db
    .update(communityPosts)
    .set({ status: "published" })
    .where(and(eq(communityPosts.id, id), eq(communityPosts.status, "pending")));
  revalidatePath("/community/admin");
  revalidatePath("/community");
}

export async function rejectCommunityPost(id: string) {
  await requireAdmin();
  await db
    .update(communityPosts)
    .set({ status: "rejected" })
    .where(eq(communityPosts.id, id));
  revalidatePath("/community/admin");
}
