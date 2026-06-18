import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { communityPosts, type CommunityPost } from "@/lib/db/schema";

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
