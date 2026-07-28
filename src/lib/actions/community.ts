"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  communityPosts,
  communityReactions,
  communityComments,
  communityPostMedia,
  users,
  type CommunityComment,
  type CommunityPost,
} from "@/lib/db/schema";
import { listPublishedPosts, getFeedSocial, getPostsMedia, type PostSocial, type PostMediaItem } from "@/lib/queries/community";
import { createNotification } from "@/lib/actions/notifications";

export interface MediaInput {
  url: string;
  kind: "image" | "video";
}

const REACTION_TYPES = ["love", "wantToGo", "beenThere"] as const;

// ── Live feed polling ────────────────────────────────────────────────────
// Not a websocket/push feed (no infra for that here) — the client polls this
// every few seconds, which reads as "real-time" for a community feed at this
// scale: new posts + fresh reaction/comment counts without a manual refresh.
export async function refreshFeed(
  knownIds: string[],
  limit = 40
): Promise<{
  newPosts: CommunityPost[];
  social: Record<string, PostSocial>;
  media: Record<string, PostMediaItem[]>;
}> {
  const session = await auth();
  const known = new Set(knownIds);

  const latest = await listPublishedPosts(limit);
  const newPosts = latest.filter((p) => !known.has(p.id));

  const allIds = [...knownIds, ...newPosts.map((p) => p.id)];
  const [social, media] = await Promise.all([
    getFeedSocial(allIds, session?.user?.id ?? ""),
    getPostsMedia(newPosts.map((p) => p.id)),
  ]);

  return { newPosts, social, media };
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

// Post about a place directly — like Instagram/Facebook, no admin approval.
// Photo(s)/video + review + rating go live immediately.
export async function submitCommunityPost(input: {
  title: string;
  description: string;
  rating?: number;
  /** @deprecated pass `media` instead — kept for older callers. */
  photoUrl?: string;
  media?: MediaInput[];
  latitude?: string;
  longitude?: string;
  locationName?: string;
}): Promise<SubmitResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in first." };

  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title || title.length < 2) return { ok: false, error: "Add the place name." };
  if (!description || description.length < 3)
    return { ok: false, error: "Write a short review." };

  const media = input.media?.length ? input.media : input.photoUrl ? [{ url: input.photoUrl, kind: "image" as const }] : [];
  for (const m of media) {
    const cap = m.kind === "video" ? 15_000_000 : 2_500_000;
    if (m.url.length > cap) {
      return { ok: false, error: m.kind === "video" ? "Video is too large — keep clips short." : "Photo is too large — try a smaller one." };
    }
  }
  if (media.length > 8) return { ok: false, error: "Up to 8 photos per post." };

  const rating =
    typeof input.rating === "number" && input.rating >= 1 && input.rating <= 5
      ? Math.round(input.rating)
      : null;

  // Read the author's CURRENT profile (pic + name) from the DB so a freshly
  // uploaded avatar / updated name is reflected on the new post, not a stale
  // value baked into the JWT session.
  const [me] = await db
    .select({ name: users.name, email: users.email, image: users.image, username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  try {
    const [created] = await db
      .insert(communityPosts)
      .values({
        userId: session.user.id,
        authorName:
          me?.name || me?.username || me?.email || session.user.name || session.user.email || "Traveller",
        authorImage: me?.image ?? session.user.image ?? null,
        title,
        description,
        rating,
        // First media item mirrors into `photoUrl` — every older piece of the
        // app that just reads `post.photoUrl` keeps working unchanged.
        photoUrl: media[0]?.url ?? null,
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        locationName: input.locationName || null,
        status: "published",
      })
      .returning({ id: communityPosts.id });

    if (created && media.length > 0) {
      await db.insert(communityPostMedia).values(
        media.map((m, i) => ({ postId: created.id, url: m.url, kind: m.kind, position: i }))
      );
    }

    revalidatePath("/community");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not post — is the database set up? Run db:push." };
  }
}

// ── Reactions ──────────────────────────────────────────────────────────────
export interface ReactionResult {
  ok: boolean;
  counts?: { love: number; wantToGo: number; beenThere: number };
  total?: number;
  mine?: string | null;
  error?: string;
}

// Toggle a travel reaction. Same type again removes it; a different type
// replaces it (one reaction per user per post). Returns fresh counts.
export async function setReaction(postId: string, type: string): Promise<ReactionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  if (!REACTION_TYPES.includes(type as (typeof REACTION_TYPES)[number]))
    return { ok: false, error: "Bad reaction." };

  try {
    const existing = await db
      .select({ type: communityReactions.type })
      .from(communityReactions)
      .where(and(eq(communityReactions.postId, postId), eq(communityReactions.userId, session.user.id)))
      .limit(1);

    let mine: string | null;
    if (existing[0]?.type === type) {
      await db
        .delete(communityReactions)
        .where(and(eq(communityReactions.postId, postId), eq(communityReactions.userId, session.user.id)));
      mine = null;
    } else {
      await db
        .insert(communityReactions)
        .values({ postId, userId: session.user.id, type })
        .onConflictDoUpdate({
          target: [communityReactions.postId, communityReactions.userId],
          set: { type },
        });
      mine = type;

      const [post] = await db
        .select({ userId: communityPosts.userId })
        .from(communityPosts)
        .where(eq(communityPosts.id, postId))
        .limit(1);
      if (post) {
        await createNotification({
          userId: post.userId,
          actorId: session.user.id,
          type: type as "love" | "wantToGo" | "beenThere",
          postId,
        });
      }
    }

    const rows = await db
      .select({ type: communityReactions.type, c: sql<number>`count(*)::int` })
      .from(communityReactions)
      .where(eq(communityReactions.postId, postId))
      .groupBy(communityReactions.type);

    const counts = { love: 0, wantToGo: 0, beenThere: 0 };
    let total = 0;
    for (const r of rows) {
      if (r.type === "love") counts.love = r.c;
      else if (r.type === "wantToGo") counts.wantToGo = r.c;
      else if (r.type === "beenThere") counts.beenThere = r.c;
      total += r.c;
    }
    return { ok: true, counts, total, mine };
  } catch {
    return { ok: false, error: "Could not react. Run db:push if you just added the tables." };
  }
}

// ── Comments ───────────────────────────────────────────────────────────────
export async function addComment(
  postId: string,
  body: string
): Promise<{ ok: boolean; comment?: CommunityComment; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  const text = body.trim();
  if (text.length < 1) return { ok: false, error: "Write something." };
  if (text.length > 1000) return { ok: false, error: "Comment too long." };

  try {
    const [created] = await db
      .insert(communityComments)
      .values({
        postId,
        userId: session.user.id,
        authorName: session.user.name || session.user.email || "Traveller",
        authorImage: session.user.image || null,
        body: text,
      })
      .returning();

    const [post] = await db
      .select({ userId: communityPosts.userId })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);
    if (post) {
      await createNotification({
        userId: post.userId,
        actorId: session.user.id,
        type: "comment",
        postId,
        commentBody: text,
      });
    }

    return { ok: true, comment: created };
  } catch {
    return { ok: false, error: "Could not comment." };
  }
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
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

// Author-only: delete a comment. Returns ok if removed.
export async function deleteComment(commentId: string): Promise<SubmitResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  try {
    const [c] = await db
      .select({ userId: communityComments.userId })
      .from(communityComments)
      .where(eq(communityComments.id, commentId))
      .limit(1);
    if (!c) return { ok: false, error: "Comment not found." };
    if (c.userId !== session.user.id)
      return { ok: false, error: "You can only delete your own comments." };
    await db.delete(communityComments).where(eq(communityComments.id, commentId));
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete comment." };
  }
}

// ── Author-only post management ──────────────────────────────────────────────
// Delete a post you authored. Reactions + comments cascade away via FK.
export async function deleteCommunityPost(postId: string): Promise<SubmitResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  try {
    const [post] = await db
      .select({ userId: communityPosts.userId })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);
    if (!post) return { ok: false, error: "Post not found." };
    if (post.userId !== session.user.id)
      return { ok: false, error: "You can only delete your own posts." };
    await db.delete(communityPosts).where(eq(communityPosts.id, postId));
    revalidatePath("/community");
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete post." };
  }
}

// Edit the caption of a post you authored (title / review / rating / location).
// The photo is kept as-is. Returns the updated row for optimistic UI.
export async function updateCommunityPost(
  postId: string,
  input: { title: string; description: string; rating?: number | null; locationName?: string | null }
): Promise<{ ok: boolean; post?: CommunityPost; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title || title.length < 2) return { ok: false, error: "Add the place name." };
  if (!description || description.length < 3) return { ok: false, error: "Write a short review." };
  const rating =
    typeof input.rating === "number" && input.rating >= 1 && input.rating <= 5
      ? Math.round(input.rating)
      : null;
  try {
    const [post] = await db
      .select({ userId: communityPosts.userId })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);
    if (!post) return { ok: false, error: "Post not found." };
    if (post.userId !== session.user.id)
      return { ok: false, error: "You can only edit your own posts." };
    const [updated] = await db
      .update(communityPosts)
      .set({ title, description, rating, locationName: input.locationName?.trim() || null })
      .where(eq(communityPosts.id, postId))
      .returning();
    revalidatePath("/community");
    revalidatePath("/profile");
    return { ok: true, post: updated };
  } catch {
    return { ok: false, error: "Could not update post." };
  }
}
