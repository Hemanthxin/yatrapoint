"use server";

import { revalidatePath } from "next/cache";
import { like, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { isAdminSession } from "@/lib/admin";
import { festivalSlug } from "@/lib/festivals";

// Festivals have no DB row of their own (they live in a static JSON file), so
// admin-uploaded photos reuse the generic `site_settings` key/value store —
// one row per festival, keyed "festival:<slug>".
const KEY_PREFIX = "festival:";
const MAX_IMAGE_BYTES = 2_000_000;

// Public — every festival image currently set, keyed by festival slug.
export async function getFestivalImages(): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select({ key: siteSettings.key, imageUrl: siteSettings.imageUrl })
      .from(siteSettings)
      .where(like(siteSettings.key, `${KEY_PREFIX}%`));
    const out: Record<string, string> = {};
    for (const r of rows) {
      if (r.imageUrl) out[r.key.slice(KEY_PREFIX.length)] = r.imageUrl;
    }
    return out;
  } catch {
    return {};
  }
}

export async function updateFestivalImage(
  festivalName: string,
  imageUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return { ok: false, error: "Admins only." };
  if (!imageUrl || imageUrl.length > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Photo is too large — try a smaller one." };
  }
  try {
    const key = KEY_PREFIX + festivalSlug(festivalName);
    await db
      .insert(siteSettings)
      .values({ key, imageUrl })
      .onConflictDoUpdate({ target: siteSettings.key, set: { imageUrl, updatedAt: new Date() } });
    revalidatePath("/festivals");
    revalidatePath("/admin/festivals");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save the photo." };
  }
}

export async function resetFestivalImage(festivalName: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return { ok: false };
  try {
    const key = KEY_PREFIX + festivalSlug(festivalName);
    await db.delete(siteSettings).where(eq(siteSettings.key, key));
    revalidatePath("/festivals");
    revalidatePath("/admin/festivals");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
