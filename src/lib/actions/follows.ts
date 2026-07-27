"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { follows } from "@/lib/db/schema";
import { getFollowCounts } from "@/lib/queries/follows";

export interface ToggleFollowResult {
  ok: boolean;
  following?: boolean;
  followerCount?: number;
  error?: string;
}

export async function toggleFollow(targetUserId: string): Promise<ToggleFollowResult> {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return { ok: false, error: "Please sign in." };
  if (me === targetUserId) return { ok: false, error: "You can't follow yourself." };

  try {
    const [existing] = await db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(and(eq(follows.followerId, me), eq(follows.followingId, targetUserId)))
      .limit(1);

    if (existing) {
      await db
        .delete(follows)
        .where(and(eq(follows.followerId, me), eq(follows.followingId, targetUserId)));
    } else {
      await db.insert(follows).values({ followerId: me, followingId: targetUserId }).onConflictDoNothing();
    }

    const counts = await getFollowCounts(targetUserId);
    revalidatePath(`/profile/${targetUserId}`);
    return { ok: true, following: !existing, followerCount: counts.followers };
  } catch {
    return { ok: false, error: "Could not update follow status." };
  }
}
