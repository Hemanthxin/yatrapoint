"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { communityPosts } from "@/lib/db/schema";

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

// Post about a place directly — like Instagram/Facebook, no admin approval.
// Photo + review + rating go live immediately.
export async function submitCommunityPost(input: {
  title: string;
  description: string;
  rating?: number;
  photoUrl?: string;
  latitude?: string;
  longitude?: string;
  locationName?: string;
}): Promise<SubmitResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in first." };

  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title || title.length < 2) return { ok: false, error: "Add the place name." };
  if (!description || description.length < 3)
    return { ok: false, error: "Write a short review." };
  if (input.photoUrl && input.photoUrl.length > 2_500_000)
    return { ok: false, error: "Photo is too large — try a smaller one." };

  const rating =
    typeof input.rating === "number" && input.rating >= 1 && input.rating <= 5
      ? Math.round(input.rating)
      : null;

  try {
    await db.insert(communityPosts).values({
      userId: session.user.id,
      authorName: session.user.name || session.user.email || "Traveller",
      authorImage: session.user.image || null,
      title,
      description,
      rating,
      photoUrl: input.photoUrl || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      locationName: input.locationName || null,
      status: "published",
    });
    revalidatePath("/community");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not post — is the database set up? Run db:push." };
  }
}
