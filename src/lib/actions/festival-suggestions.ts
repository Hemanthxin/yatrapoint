"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { festivalSuggestions, type FestivalSuggestion } from "@/lib/db/schema";
import { isAdminSession } from "@/lib/admin";
import type { Festival } from "@/lib/festivals";

// BUG-10: travellers and community members can put a locally-organised
// festival or event on the map. Submissions are held for admin approval, so
// /festivals stays trustworthy while still covering the local jatres, temple
// car festivals and town fairs the static national list will never have.

const MAX_IMAGE_BYTES = 2_000_000;

const suggestionSchema = z.object({
  name: z.string().trim().min(3, "Give the festival a name.").max(140),
  hub: z.string().trim().max(160).optional(),
  // Either an exact date or a free-text one ("second week of March") — a local
  // festival often has no fixed calendar day, and demanding one would keep the
  // very events this exists for out.
  dateISO: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date.")
    .optional()
    .or(z.literal("")),
  dateLabel: z.string().trim().max(80).optional(),
  significance: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().max(MAX_IMAGE_BYTES).optional(),
});

export interface SuggestFestivalResult {
  ok: boolean;
  error?: string;
}

export async function suggestFestival(input: {
  name: string;
  hub?: string;
  dateISO?: string;
  dateLabel?: string;
  significance?: string;
  imageUrl?: string;
}): Promise<SuggestFestivalResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in to suggest a festival." };

  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }
  const d = parsed.data;
  if (!d.dateISO && !d.dateLabel?.trim()) {
    return { ok: false, error: "Add a date, or describe when it happens." };
  }

  try {
    await db.insert(festivalSuggestions).values({
      userId: session.user.id,
      submittedByName: session.user.name || session.user.email || null,
      name: d.name,
      hub: d.hub?.trim() || null,
      dateISO: d.dateISO || null,
      dateLabel: d.dateLabel?.trim() || null,
      significance: d.significance?.trim() || null,
      imageUrl: d.imageUrl?.trim() || null,
      status: "pending",
    });
    revalidatePath("/festivals");
    revalidatePath("/admin/festivals");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that — please try again." };
  }
}

// Approved community festivals, shaped exactly like the built-in ones so the
// Festivals page can merge the two lists without special-casing either.
export async function listApprovedFestivals(): Promise<Festival[]> {
  try {
    const rows = await db
      .select()
      .from(festivalSuggestions)
      .where(eq(festivalSuggestions.status, "approved"))
      .orderBy(desc(festivalSuggestions.createdAt));
    return rows.map(toFestival);
  } catch {
    // A missing table (migration not run yet) must not take down /festivals.
    return [];
  }
}

function toFestival(row: FestivalSuggestion): Festival {
  return {
    name: row.name,
    hub: row.hub,
    dateISO: row.dateISO,
    dateLabel: row.dateLabel || row.dateISO || "Date to be announced",
    significance: row.significance,
    emoji: "🎪",
  };
}

// The submitter's own suggestions, so they can see whether theirs went live.
export async function listMyFestivalSuggestions(): Promise<FestivalSuggestion[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  try {
    return await db
      .select()
      .from(festivalSuggestions)
      .where(eq(festivalSuggestions.userId, session.user.id))
      .orderBy(desc(festivalSuggestions.createdAt))
      .limit(20);
  } catch {
    return [];
  }
}

// --- Admin moderation ---

export async function listPendingFestivalSuggestions(): Promise<FestivalSuggestion[]> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return [];
  try {
    return await db
      .select()
      .from(festivalSuggestions)
      .where(eq(festivalSuggestions.status, "pending"))
      .orderBy(desc(festivalSuggestions.createdAt))
      .limit(100);
  } catch {
    return [];
  }
}

export async function reviewFestivalSuggestion(
  id: string,
  decision: "approved" | "rejected",
  reviewNote?: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!isAdminSession(session?.user)) return { ok: false, error: "Admins only." };
  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false, error: "Unknown decision." };
  }
  try {
    await db
      .update(festivalSuggestions)
      .set({
        status: decision,
        reviewNote: reviewNote?.trim().slice(0, 300) || null,
        reviewedAt: new Date(),
      })
      // Only a still-pending row may be decided, so two admins acting at once
      // can't flip an already-published festival back and forth.
      .where(and(eq(festivalSuggestions.id, id), eq(festivalSuggestions.status, "pending")));
    revalidatePath("/festivals");
    revalidatePath("/admin/festivals");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that decision — please try again." };
  }
}
