"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { destinations } from "@/lib/db/schema";
import { createId } from "@/lib/utils/id";
import { isAdminSession } from "@/lib/admin";

const placeSchema = z.object({
  name: z.string().trim().min(3).max(120),
  state: z.string().trim().min(2).max(60),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  category: z.string().trim().min(2).max(40),
  placeType: z.string().trim().min(2).max(60).optional().or(z.literal("")),
  description: z.string().trim().min(20).max(5000),
  shortDescription: z.string().trim().min(20).max(220),
  imageUrl: z.string().trim().optional().or(z.literal("")),
  openingTimings: z.string().trim().max(120).optional().or(z.literal("")),
  entryFees: z.coerce.number().int().min(0),
  budgetPerDay: z.coerce.number().int().min(0),
  recommendedDays: z.coerce.number().int().min(1).max(365),
  bestMonths: z.string().trim().max(120).optional().or(z.literal("")),
  latitude: z.string().trim().max(20).optional().or(z.literal("")),
  longitude: z.string().trim().max(20).optional().or(z.literal("")),
  popularity: z.coerce.number().int().min(0).max(100).optional(),
  isHidden: z.coerce.boolean().optional(),
});

export interface AddPlaceResult {
  ok: boolean;
  error?: string;
  id?: string;
  slug?: string;
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `place-${createId(4)}`;
}

async function requireAdmin() {
  const session = await auth();
  if (!isAdminSession(session?.user)) {
    throw new Error("Not authorised");
  }
  return session!.user!;
}

export async function addAdminPlace(
  input: z.input<typeof placeSchema>
): Promise<AddPlaceResult> {
  try {
    const admin = await requireAdmin();
    const parsed = placeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form values." };
    }

    const data = parsed.data;
    const name = data.name.trim();

    // Reject duplicates — same place name in the same state (case-insensitive).
    const duplicate = await db
      .select({ id: destinations.id })
      .from(destinations)
      .where(
        and(
          eq(sql`lower(${destinations.name})`, name.toLowerCase()),
          eq(sql`lower(${destinations.state})`, data.state.trim().toLowerCase())
        )
      )
      .limit(1);
    if (duplicate.length > 0) {
      return { ok: false, error: `"${name}" already exists in ${data.state.trim()}.` };
    }

    const baseSlug = slugify(name);
    let slug = baseSlug;
    let tries = 0;

    while (tries < 5) {
      const exists = await db
        .select({ id: destinations.id })
        .from(destinations)
        .where(eq(destinations.slug, slug))
        .limit(1);
      if (exists.length === 0) break;
      slug = `${baseSlug}-${createId(3).slice(0, 4)}`;
      tries += 1;
    }

    if (data.imageUrl && data.imageUrl.length > 2_000_000) {
      return { ok: false, error: "Image is too large. Please use a smaller photo." };
    }

    const [created] = await db
      .insert(destinations)
      .values({
        slug,
        name,
        state: data.state,
        district: data.district || null,
        category: data.category,
        placeType: data.placeType || null,
        description: data.description,
        shortDescription: data.shortDescription,
        imageUrl: data.imageUrl || null,
        openingTimings: data.openingTimings || null,
        entryFees: data.entryFees,
        budgetPerDay: data.budgetPerDay,
        recommendedDays: data.recommendedDays,
        bestMonths: data.bestMonths || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        popularity: data.popularity ?? 50,
        isHidden: data.isHidden ?? false,
        addedByEmail: admin.email ?? null,
        addedByName: admin.name ?? admin.email ?? "Admin",
      })
      .returning();

    revalidatePath("/admin/dashboard");
    revalidatePath("/destinations");
    revalidatePath("/");
    return { ok: true, id: created.id, slug: created.slug };
  } catch {
    return { ok: false, error: "Could not add place. Check DATABASE_URL and run db push." };
  }
}
