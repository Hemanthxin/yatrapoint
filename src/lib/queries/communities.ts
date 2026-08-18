import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  communities,
  communityMembers,
  communityPosts,
  users,
  type Community,
} from "@/lib/db/schema";

export interface CommunitySummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImage: string | null;
  memberCount: number;
  postCount: number;
  creatorId: string;
  createdAt: Date;
}

// Batches a post count onto each community row — one query for the whole
// list, same idiom as getFeedSocial/getPostsMedia in queries/community.ts.
async function withPostCounts(rows: Community[]): Promise<CommunitySummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const counts = await db
    .select({ communityId: communityPosts.communityId, c: sql<number>`count(*)::int` })
    .from(communityPosts)
    .where(inArray(communityPosts.communityId, ids))
    .groupBy(communityPosts.communityId);
  const byId = new Map(counts.map((c) => [c.communityId as string, c.c]));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    coverImage: r.coverImage,
    memberCount: r.memberCount,
    postCount: byId.get(r.id) ?? 0,
    creatorId: r.creatorId,
    createdAt: r.createdAt,
  }));
}

export async function listCommunities(opts?: { search?: string }): Promise<CommunitySummary[]> {
  try {
    const rows = opts?.search
      ? await db
          .select()
          .from(communities)
          .where(ilike(communities.name, `%${opts.search}%`))
          .orderBy(desc(communities.createdAt))
          .limit(100)
      : await db.select().from(communities).orderBy(desc(communities.createdAt)).limit(100);
    return withPostCounts(rows);
  } catch {
    return [];
  }
}

export async function getCommunityBySlug(slug: string): Promise<Community | null> {
  try {
    const [row] = await db.select().from(communities).where(eq(communities.slug, slug)).limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

// Batched — every community's membership status for one user in a single
// query, so the directory page doesn't run one query per card.
export async function getMembershipsForUser(userId: string): Promise<Record<string, { role: string; status: string }>> {
  const out: Record<string, { role: string; status: string }> = {};
  if (!userId) return out;
  try {
    const rows = await db
      .select({ communityId: communityMembers.communityId, role: communityMembers.role, status: communityMembers.status })
      .from(communityMembers)
      .where(eq(communityMembers.userId, userId));
    for (const r of rows) out[r.communityId] = { role: r.role, status: r.status };
  } catch {
    // ignore — callers treat a missing entry as "not a member"
  }
  return out;
}

export async function getMembership(
  communityId: string,
  userId: string
): Promise<{ role: string; status: string } | null> {
  if (!communityId || !userId) return null;
  try {
    const [row] = await db
      .select({ role: communityMembers.role, status: communityMembers.status })
      .from(communityMembers)
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export interface PendingRequestRow {
  userId: string;
  name: string;
  image: string | null;
  requestedAt: Date;
}

// Owner-only — the list an approve/reject panel renders.
export async function listPendingRequests(communityId: string): Promise<PendingRequestRow[]> {
  try {
    const rows = await db
      .select({
        userId: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
        requestedAt: communityMembers.createdAt,
      })
      .from(communityMembers)
      .innerJoin(users, eq(users.id, communityMembers.userId))
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.status, "pending")))
      .orderBy(desc(communityMembers.createdAt));
    return rows.map((r) => ({
      userId: r.userId,
      name: r.name || r.username || "Traveller",
      image: r.image,
      requestedAt: r.requestedAt,
    }));
  } catch {
    return [];
  }
}

export async function getCommunityStats(): Promise<{ travellers: number; posts: number; communities: number }> {
  try {
    const [[travellers], [posts], [communityCount]] = await Promise.all([
      db.select({ c: sql<number>`count(distinct ${communityPosts.userId})::int` }).from(communityPosts),
      db.select({ c: sql<number>`count(*)::int` }).from(communityPosts),
      db.select({ c: sql<number>`count(*)::int` }).from(communities),
    ]);
    return {
      travellers: travellers?.c ?? 0,
      posts: posts?.c ?? 0,
      communities: communityCount?.c ?? 0,
    };
  } catch {
    return { travellers: 0, posts: 0, communities: 0 };
  }
}

// v1: ranked by member count — an honest placeholder ("trending" would
// really want a recency-weighted join/post score) that's upgradeable later
// without a schema change.
export async function getTrendingCommunities(limit = 5): Promise<CommunitySummary[]> {
  try {
    const rows = await db.select().from(communities).orderBy(desc(communities.memberCount)).limit(limit);
    return withPostCounts(rows);
  } catch {
    return [];
  }
}

export interface TopContributor {
  userId: string;
  name: string;
  image: string | null;
  postCount: number;
}

export async function getTopContributors(limit = 5): Promise<TopContributor[]> {
  try {
    const rows = await db
      .select({
        userId: communityPosts.userId,
        name: users.name,
        username: users.username,
        image: users.image,
        postCount: sql<number>`count(*)::int`,
      })
      .from(communityPosts)
      .innerJoin(users, eq(users.id, communityPosts.userId))
      .groupBy(communityPosts.userId, users.name, users.username, users.image)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows.map((r) => ({
      userId: r.userId,
      name: r.name || r.username || "Traveller",
      image: r.image,
      postCount: r.postCount,
    }));
  } catch {
    return [];
  }
}

// Batched per-author post count for the whole feed — one query, not one per
// card. Callers derive a contributor-tier badge from the count client-side.
export async function getAuthorPostCounts(userIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (userIds.length === 0) return out;
  try {
    const rows = await db
      .select({ userId: communityPosts.userId, c: sql<number>`count(*)::int` })
      .from(communityPosts)
      .where(inArray(communityPosts.userId, userIds))
      .groupBy(communityPosts.userId);
    for (const r of rows) out[r.userId] = r.c;
  } catch {
    // ignore — callers treat a missing entry as 0
  }
  return out;
}
