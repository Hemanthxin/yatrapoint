import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { communityPosts, users, type CommunityPost } from "@/lib/db/schema";

export interface UserResult {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

export async function searchUsers(query: string, limit = 12): Promise<UserResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const rows = await db
      .select({ id: users.id, name: users.name, username: users.username, image: users.image })
      .from(users)
      .where(or(ilike(users.name, `%${q}%`), ilike(users.username, `%${q}%`)))
      .limit(limit);
    return rows.map((r) => ({ ...r, name: r.name || r.username || "Traveller" }));
  } catch {
    return [];
  }
}

export async function searchPosts(query: string, limit = 40): Promise<CommunityPost[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    return await db
      .select()
      .from(communityPosts)
      .where(
        and(
          eq(communityPosts.status, "published"),
          or(
            ilike(communityPosts.title, `%${q}%`),
            ilike(communityPosts.description, `%${q}%`),
            ilike(communityPosts.locationName, `%${q}%`)
          )
        )
      )
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function searchByHashtag(tag: string, limit = 40): Promise<CommunityPost[]> {
  const t = tag.trim().replace(/^#/, "");
  if (!t) return [];
  try {
    return await db
      .select()
      .from(communityPosts)
      .where(and(eq(communityPosts.status, "published"), ilike(communityPosts.description, `%#${t}%`)))
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}
