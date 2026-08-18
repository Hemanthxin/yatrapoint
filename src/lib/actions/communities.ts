"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { communities, communityMembers } from "@/lib/db/schema";
import { createId } from "@/lib/utils/id";
import { createNotification } from "@/lib/actions/notifications";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return base || `community-${createId(4)}`;
}

export async function createCommunity(input: {
  name: string;
  description: string;
  coverImage?: string;
}): Promise<ActionResult & { slug?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in first." };

  const name = input.name?.trim();
  const description = input.description?.trim();
  if (!name || name.length < 3) return { ok: false, error: "Give the community a name." };
  if (!description || description.length < 10) return { ok: false, error: "Add a short description." };

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let tries = 0;
  try {
    while (tries < 5) {
      const exists = await db.select({ id: communities.id }).from(communities).where(eq(communities.slug, slug)).limit(1);
      if (exists.length === 0) break;
      slug = `${baseSlug}-${createId(3).slice(0, 4)}`;
      tries += 1;
    }

    const [created] = await db
      .insert(communities)
      .values({
        slug,
        name,
        description,
        coverImage: input.coverImage || null,
        creatorId: session.user.id,
      })
      .returning({ id: communities.id, slug: communities.slug });
    if (!created) return { ok: false, error: "Could not create community." };

    // Creator is auto-approved as owner — no db.transaction here (neon-http
    // driver, no existing transaction usage in this codebase); treat any
    // failure past this point as a hard error so an ownerless community is
    // never left reachable.
    await db.insert(communityMembers).values({
      communityId: created.id,
      userId: session.user.id,
      role: "owner",
      status: "approved",
    });

    revalidatePath("/community/groups");
    return { ok: true, slug: created.slug };
  } catch {
    return { ok: false, error: "Could not create community. Run db:push if you just added the tables." };
  }
}

export async function requestToJoin(communityId: string): Promise<ActionResult & { status?: "pending" | "approved" }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in first." };
  const me = session.user.id;

  try {
    const [community] = await db.select({ creatorId: communities.creatorId }).from(communities).where(eq(communities.id, communityId)).limit(1);
    if (!community) return { ok: false, error: "Community not found." };

    const [existing] = await db
      .select({ status: communityMembers.status })
      .from(communityMembers)
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, me)))
      .limit(1);
    // Already requested (or already a member) — no-op, no duplicate notification.
    if (existing) return { ok: true, status: existing.status as "pending" | "approved" };

    await db.insert(communityMembers).values({ communityId, userId: me, role: "member", status: "pending" });
    await createNotification({ userId: community.creatorId, actorId: me, type: "communityJoinRequest", communityId });

    revalidatePath(`/community/groups`);
    return { ok: true, status: "pending" };
  } catch {
    return { ok: false, error: "Could not send join request." };
  }
}

async function requireOwner(communityId: string): Promise<{ ok: true; creatorId: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  const [community] = await db.select({ creatorId: communities.creatorId }).from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false, error: "Community not found." };
  if (community.creatorId !== session.user.id) return { ok: false, error: "Only the community creator can do that." };
  return { ok: true, creatorId: community.creatorId };
}

export async function approveJoinRequest(communityId: string, userId: string): Promise<ActionResult> {
  const owner = await requireOwner(communityId);
  if (!owner.ok) return owner;

  try {
    const [updated] = await db
      .update(communityMembers)
      .set({ status: "approved" })
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId), eq(communityMembers.status, "pending")))
      .returning({ userId: communityMembers.userId });
    if (!updated) return { ok: false, error: "Request not found." };

    await db.update(communities).set({ memberCount: sql`${communities.memberCount} + 1` }).where(eq(communities.id, communityId));
    await createNotification({ userId, actorId: owner.creatorId, type: "communityJoinApproved", communityId });

    revalidatePath(`/community/groups`);
    revalidatePath(`/community/notifications`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not approve request." };
  }
}

export async function rejectJoinRequest(communityId: string, userId: string): Promise<ActionResult> {
  const owner = await requireOwner(communityId);
  if (!owner.ok) return owner;

  try {
    await db
      .delete(communityMembers)
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId), eq(communityMembers.status, "pending")));
    revalidatePath(`/community/notifications`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reject request." };
  }
}

export async function leaveCommunity(communityId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  const me = session.user.id;

  try {
    const [membership] = await db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, me)))
      .limit(1);
    if (!membership) return { ok: false, error: "You're not a member." };
    if (membership.role === "owner") return { ok: false, error: "The creator can't leave their own community." };

    await db.delete(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, me)));
    await db.update(communities).set({ memberCount: sql`greatest(${communities.memberCount} - 1, 0)` }).where(eq(communities.id, communityId));

    revalidatePath(`/community/groups`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not leave community." };
  }
}
