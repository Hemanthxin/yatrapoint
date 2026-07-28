"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";

export type NotificationType = "love" | "wantToGo" | "beenThere" | "comment" | "follow" | "message";

// Shared by setReaction/addComment/toggleFollow/sendMessage — never notifies
// someone about their own activity, and swallows errors so a notification
// failure can never break the action that triggered it.
export async function createNotification(input: {
  userId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
  commentBody?: string | null;
}): Promise<void> {
  if (input.userId === input.actorId) return;
  try {
    await db.insert(notifications).values({
      userId: input.userId,
      actorId: input.actorId,
      type: input.type,
      postId: input.postId ?? null,
      commentBody: input.commentBody ?? null,
    });
  } catch {
    // best-effort — never block the parent action
  }
}

export async function getMyUnreadNotificationCount(): Promise<number> {
  const session = await auth();
  return getUnreadNotificationCount(session?.user?.id ?? "");
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return { ok: false };
  try {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, me), eq(notifications.read, false)));
    revalidatePath("/community/notifications");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
