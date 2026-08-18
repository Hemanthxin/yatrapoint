import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users, communityPosts, communities } from "@/lib/db/schema";

export interface NotificationRow {
  id: string;
  type: string;
  read: boolean;
  createdAt: Date;
  commentBody: string | null;
  actorId: string;
  actorName: string | null;
  actorImage: string | null;
  postId: string | null;
  postTitle: string | null;
  postPhotoUrl: string | null;
  communityId: string | null;
  communityName: string | null;
  communitySlug: string | null;
}

export async function listNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  if (!userId) return [];
  try {
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        read: notifications.read,
        createdAt: notifications.createdAt,
        commentBody: notifications.commentBody,
        postId: notifications.postId,
        actorId: users.id,
        actorName: users.name,
        actorUsername: users.username,
        actorImage: users.image,
        postTitle: communityPosts.title,
        postPhotoUrl: communityPosts.photoUrl,
        communityId: notifications.communityId,
        communityName: communities.name,
        communitySlug: communities.slug,
      })
      .from(notifications)
      .innerJoin(users, eq(users.id, notifications.actorId))
      .leftJoin(communityPosts, eq(communityPosts.id, notifications.postId))
      .leftJoin(communities, eq(communities.id, notifications.communityId))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      read: r.read,
      createdAt: r.createdAt,
      commentBody: r.commentBody,
      actorId: r.actorId,
      actorName: r.actorName || r.actorUsername || "Traveller",
      actorImage: r.actorImage,
      postId: r.postId,
      postTitle: r.postTitle,
      postPhotoUrl: r.postPhotoUrl,
      communityId: r.communityId,
      communityName: r.communityName,
      communitySlug: r.communitySlug,
    }));
  } catch {
    return [];
  }
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}
