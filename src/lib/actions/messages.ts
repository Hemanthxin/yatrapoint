"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { messages, type Message } from "@/lib/db/schema";
import { createNotification } from "@/lib/actions/notifications";
import { getUnreadMessageCount } from "@/lib/queries/messages";

export interface SendMessageResult {
  ok: boolean;
  message?: Message;
  error?: string;
}

export async function sendMessage(recipientId: string, body: string): Promise<SendMessageResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  if (session.user.id === recipientId) return { ok: false, error: "You can't message yourself." };

  const text = body.trim();
  if (text.length < 1) return { ok: false, error: "Write something." };
  if (text.length > 2000) return { ok: false, error: "Message too long." };

  try {
    const [created] = await db
      .insert(messages)
      .values({ senderId: session.user.id, recipientId, body: text })
      .returning();

    await createNotification({ userId: recipientId, actorId: session.user.id, type: "message" });

    revalidatePath("/community/messages");
    revalidatePath(`/community/messages/${recipientId}`);
    return { ok: true, message: created };
  } catch {
    return { ok: false, error: "Could not send message." };
  }
}

export async function getMyUnreadMessageCount(): Promise<number> {
  const session = await auth();
  return getUnreadMessageCount(session?.user?.id ?? "");
}

export async function markThreadRead(otherUserId: string): Promise<{ ok: boolean }> {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return { ok: false };
  try {
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.senderId, otherUserId), eq(messages.recipientId, me), isNull(messages.readAt)));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// Poll for new messages in a thread since the last-known message's
// timestamp — same "poll every few seconds" pattern as `refreshFeed`.
export async function refreshThread(otherUserId: string, sinceIso: string | null): Promise<{ messages: Message[] }> {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return { messages: [] };

  const since = sinceIso ? new Date(sinceIso) : new Date(0);
  try {
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          or(and(eq(messages.senderId, me), eq(messages.recipientId, otherUserId)), and(eq(messages.senderId, otherUserId), eq(messages.recipientId, me))),
          gt(messages.createdAt, since)
        )
      )
      .orderBy(messages.createdAt);
    return { messages: rows };
  } catch {
    return { messages: [] };
  }
}
