"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { isAdminSession } from "@/lib/admin";

const HERO_BANNER_KEY = "hero_banner";
const MAX_IMAGE_BYTES = 2_000_000;

// Public — the dashboard hero banner image, or null to use the built-in default.
export async function getHeroBannerImage(): Promise<string | null> {
  try {
    const [row] = await db
      .select({ imageUrl: siteSettings.imageUrl })
      .from(siteSettings)
      .where(eq(siteSettings.key, HERO_BANNER_KEY));
    return row?.imageUrl ?? null;
  } catch {
    return null;
  }
}

export async function updateHeroBannerImage(
  imageUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return { ok: false, error: "Admins only." };
  if (!imageUrl || imageUrl.length > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Photo is too large — try a smaller one." };
  }
  try {
    await db
      .insert(siteSettings)
      .values({ key: HERO_BANNER_KEY, imageUrl })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { imageUrl, updatedAt: new Date() },
      });
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save the banner image." };
  }
}

// Clear the custom banner — the dashboard falls back to the built-in default.
export async function resetHeroBannerImage(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return { ok: false };
  try {
    await db
      .insert(siteSettings)
      .values({ key: HERO_BANNER_KEY, imageUrl: null })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { imageUrl: null, updatedAt: new Date() },
      });
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
