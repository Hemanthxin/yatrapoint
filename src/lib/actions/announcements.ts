"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { announcements, type Announcement } from "@/lib/db/schema";
import { isAdminSession } from "@/lib/admin";

// Public — active headline messages for the news ticker (callable from the
// client Marquee component).
export async function fetchHeadlines(): Promise<string[]> {
  try {
    const rows = await db
      .select({ message: announcements.message })
      .from(announcements)
      .where(eq(announcements.isActive, true))
      .orderBy(desc(announcements.createdAt))
      .limit(20);
    return rows.map((r) => r.message);
  } catch {
    return [];
  }
}

// Admin — full list for the manager.
export async function listAnnouncements(): Promise<Announcement[]> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return [];
  try {
    return await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(100);
  } catch {
    return [];
  }
}

export async function addAnnouncement(message: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return { ok: false, error: "Admins only." };
  const text = message.trim();
  if (text.length < 3) return { ok: false, error: "Headline is too short." };
  if (text.length > 300) return { ok: false, error: "Headline is too long (max 300)." };
  try {
    await db.insert(announcements).values({ message: text, isActive: true });
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save headline." };
  }
}

export async function toggleAnnouncement(id: string, isActive: boolean): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return { ok: false };
  try {
    await db.update(announcements).set({ isActive }).where(eq(announcements.id, id));
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function deleteAnnouncement(id: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return { ok: false };
  try {
    await db.delete(announcements).where(eq(announcements.id, id));
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
