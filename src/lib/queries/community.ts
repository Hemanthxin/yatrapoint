import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  communityPosts,
  communityReactions,
  communityComments,
  type CommunityPost,
  type CommunityComment,
} from "@/lib/db/schema";

export interface PostSocial {
  counts: { love: number; wantToGo: number; beenThere: number };
  total: number;
  comments: number;
  mine: string | null;
}

export function emptySocial(): PostSocial {
  return { counts: { love: 0, wantToGo: 0, beenThere: 0 }, total: 0, comments: 0, mine: null };
}

// Reaction counts, the current user's reaction, and comment counts for a feed.
export async function getFeedSocial(
  postIds: string[],
  userId: string
): Promise<Record<string, PostSocial>> {
  const out: Record<string, PostSocial> = {};
  for (const id of postIds) out[id] = emptySocial();
  if (postIds.length === 0) return out;
  try {
    const [reactRows, mineRows, commentRows] = await Promise.all([
      db
        .select({
          postId: communityReactions.postId,
          type: communityReactions.type,
          c: sql<number>`count(*)::int`,
        })
        .from(communityReactions)
        .where(inArray(communityReactions.postId, postIds))
        .groupBy(communityReactions.postId, communityReactions.type),
      userId
        ? db
            .select({ postId: communityReactions.postId, type: communityReactions.type })
            .from(communityReactions)
            .where(and(inArray(communityReactions.postId, postIds), eq(communityReactions.userId, userId)))
        : Promise.resolve([] as { postId: string; type: string }[]),
      db
        .select({ postId: communityComments.postId, c: sql<number>`count(*)::int` })
        .from(communityComments)
        .where(inArray(communityComments.postId, postIds))
        .groupBy(communityComments.postId),
    ]);

    for (const r of reactRows) {
      const s = out[r.postId];
      if (!s) continue;
      if (r.type === "love") s.counts.love = r.c;
      else if (r.type === "wantToGo") s.counts.wantToGo = r.c;
      else if (r.type === "beenThere") s.counts.beenThere = r.c;
      s.total += r.c;
    }
    for (const r of mineRows) if (out[r.postId]) out[r.postId].mine = r.type;
    for (const r of commentRows) if (out[r.postId]) out[r.postId].comments = r.c;
  } catch {
    // ignore — return zeros
  }
  return out;
}

export async function listComments(postId: string): Promise<CommunityComment[]> {
  try {
    return await db
      .select()
      .from(communityComments)
      .where(eq(communityComments.postId, postId))
      .orderBy(desc(communityComments.createdAt))
      .limit(100);
  } catch {
    return [];
  }
}

export async function listPublishedPosts(limit = 60): Promise<CommunityPost[]> {
  try {
    return await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.status, "published"))
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function listPendingPosts(limit = 100): Promise<CommunityPost[]> {
  try {
    return await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.status, "pending"))
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function listMyPosts(userId: string, limit = 50): Promise<CommunityPost[]> {
  try {
    return await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.userId, userId))
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}
