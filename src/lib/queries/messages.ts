import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, users } from "@/lib/db/schema";

export interface ConversationRow {
  otherUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
  lastBody: string;
  lastCreatedAt: Date;
  lastFromMe: boolean;
  unreadCount: number;
}

// A "conversation" isn't its own table — it's every message pair grouped by
// the other participant, same spirit as Stories deriving "story" from
// recent posts. Fine at this app's scale; revisit if message volume grows.
export async function listConversations(userId: string): Promise<ConversationRow[]> {
  if (!userId) return [];
  try {
    const rows = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        body: messages.body,
        createdAt: messages.createdAt,
        readAt: messages.readAt,
      })
      .from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)))
      .orderBy(desc(messages.createdAt))
      .limit(500);

    const byOther = new Map<string, ConversationRow>();
    for (const r of rows) {
      const otherId = r.senderId === userId ? r.recipientId : r.senderId;
      if (!byOther.has(otherId)) {
        byOther.set(otherId, {
          otherUserId: otherId,
          otherUserName: "",
          otherUserImage: null,
          lastBody: r.body,
          lastCreatedAt: r.createdAt,
          lastFromMe: r.senderId === userId,
          unreadCount: 0,
        });
      }
      if (r.recipientId === userId && !r.readAt) {
        byOther.get(otherId)!.unreadCount += 1;
      }
    }

    const otherIds = [...byOther.keys()];
    if (otherIds.length === 0) return [];

    const profiles = await db
      .select({ id: users.id, name: users.name, username: users.username, image: users.image })
      .from(users)
      .where(inArray(users.id, otherIds));
    for (const p of profiles) {
      const conv = byOther.get(p.id);
      if (conv) {
        conv.otherUserName = p.name || p.username || "Traveller";
        conv.otherUserImage = p.image;
      }
    }

    return [...byOther.values()].sort((a, b) => b.lastCreatedAt.getTime() - a.lastCreatedAt.getTime());
  } catch {
    return [];
  }
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.recipientId, userId), isNull(messages.readAt)));
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

export async function listThread(userId: string, otherUserId: string, limit = 200) {
  try {
    return await db
      .select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId), eq(messages.recipientId, otherUserId)),
          and(eq(messages.senderId, otherUserId), eq(messages.recipientId, userId))
        )
      )
      .orderBy(asc(messages.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}
