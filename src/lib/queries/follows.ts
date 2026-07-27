import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, users } from "@/lib/db/schema";

export interface FollowCounts {
  followers: number;
  following: number;
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [[followers], [following]] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, userId)),
    db.select({ c: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerId, userId)),
  ]);
  return { followers: followers?.c ?? 0, following: following?.c ?? 0 };
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (!followerId || followerId === followingId) return false;
  const [row] = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  return !!row;
}

export interface PublicProfile {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  bio: string | null;
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const [row] = await db
    .select({ id: users.id, name: users.name, username: users.username, image: users.image, bio: users.bio })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

interface FollowUserRow {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

export async function listFollowers(userId: string, limit = 200): Promise<FollowUserRow[]> {
  return db
    .select({ id: users.id, name: users.name, username: users.username, image: users.image })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(eq(follows.followingId, userId))
    .limit(limit);
}

export async function listFollowing(userId: string, limit = 200): Promise<FollowUserRow[]> {
  return db
    .select({ id: users.id, name: users.name, username: users.username, image: users.image })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .where(eq(follows.followerId, userId))
    .limit(limit);
}
