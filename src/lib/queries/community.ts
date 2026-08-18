import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  communityPosts,
  communityReactions,
  communityComments,
  communityPostMedia,
  type CommunityPost,
  type CommunityComment,
  type CommunityPostMedia,
} from "@/lib/db/schema";

export interface PostMediaItem {
  url: string;
  kind: "image" | "video";
}

// Extra media (beyond `post.photoUrl`) for a set of posts, keyed by post id
// and ordered by `position` — powers the swipeable multi-photo/video
// carousel. Posts with no extra rows (the common case for older posts)
// simply won't have a key here; callers fall back to `post.photoUrl`.
export async function getPostsMedia(postIds: string[]): Promise<Record<string, PostMediaItem[]>> {
  const out: Record<string, PostMediaItem[]> = {};
  if (postIds.length === 0) return out;
  try {
    const rows = await db
      .select()
      .from(communityPostMedia)
      .where(inArray(communityPostMedia.postId, postIds))
      .orderBy(communityPostMedia.position);
    for (const r of rows) {
      (out[r.postId] ??= []).push({ url: r.url, kind: r.kind === "video" ? "video" : "image" });
    }
  } catch {
    // ignore — callers fall back to photoUrl
  }
  return out;
}

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

// `communityId` scopes to one community's page; omitted, this is the global
// feed (ungrouped + grouped posts together, unchanged from before communities
// existed).
export async function listPublishedPosts(limit = 60, communityId?: string): Promise<CommunityPost[]> {
  try {
    return await db
      .select()
      .from(communityPosts)
      .where(
        communityId
          ? and(eq(communityPosts.status, "published"), eq(communityPosts.communityId, communityId))
          : eq(communityPosts.status, "published")
      )
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

// Reels — every published post whose FIRST media item is a video.
export async function listVideoPosts(limit = 40): Promise<CommunityPost[]> {
  try {
    const rows = await db
      .select({ post: communityPosts })
      .from(communityPostMedia)
      .innerJoin(communityPosts, eq(communityPosts.id, communityPostMedia.postId))
      .where(
        and(
          eq(communityPostMedia.position, 0),
          eq(communityPostMedia.kind, "video"),
          eq(communityPosts.status, "published")
        )
      )
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit);
    return rows.map((r) => r.post);
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
