"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { places, placeImages } from "@/lib/db/schema";
import { PLACE_KINDS } from "@/lib/queries/places";
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
  entryFeesForeigner: z.coerce.number().int().min(0).nullable().optional(),
  entryFeesChild: z.coerce.number().int().min(0).nullable().optional(),
  bookingUrl: z.string().trim().max(500).nullable().optional().or(z.literal("")),
  visitorGuidelines: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
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
      .select({ id: places.id })
      .from(places)
      .where(
        and(
          eq(sql`lower(${places.name})`, name.toLowerCase()),
          eq(sql`lower(${places.state})`, data.state.trim().toLowerCase())
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
        .select({ id: places.id })
        .from(places)
        .where(eq(places.slug, slug))
        .limit(1);
      if (exists.length === 0) break;
      slug = `${baseSlug}-${createId(3).slice(0, 4)}`;
      tries += 1;
    }

    if (data.imageUrl && data.imageUrl.length > 2_000_000) {
      return { ok: false, error: "Image is too large. Please use a smaller photo." };
    }

    const [created] = await db
      .insert(places)
      .values({
        slug,
        name,
        // An admin-added place is a catalogue destination.
        kinds: PLACE_KINDS.destination,
        state: data.state,
        district: data.district || null,
        category: data.category,
        placeType: data.placeType || null,
        description: data.description,
        shortDescription: data.shortDescription,
        imageUrl: data.imageUrl || null,
        openingTimings: data.openingTimings || null,
        entryFeePerPerson: data.entryFees,
        entryFeesForeigner: data.entryFeesForeigner ?? null,
        entryFeesChild: data.entryFeesChild ?? null,
        bookingUrl: data.bookingUrl || null,
        visitorGuidelines: data.visitorGuidelines || null,
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
    revalidatePath("/admin/places");
    revalidatePath("/destinations");
    revalidatePath("/");
    return { ok: true, id: created.id, slug: created.slug };
  } catch {
    return { ok: false, error: "Could not add place. Check DATABASE_URL and run db push." };
  }
}

export async function updateAdminPlace(
  id: string,
  input: z.input<typeof placeSchema>
): Promise<AddPlaceResult> {
  try {
    await requireAdmin();
    const parsed = placeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form values." };
    }
    const data = parsed.data;
    const name = data.name.trim();

    if (data.imageUrl && data.imageUrl.length > 2_000_000) {
      return { ok: false, error: "Image is too large. Please use a smaller photo." };
    }

    // Block duplicate name+state on a DIFFERENT place.
    const dup = await db
      .select({ id: places.id })
      .from(places)
      .where(
        and(
          eq(sql`lower(${places.name})`, name.toLowerCase()),
          eq(sql`lower(${places.state})`, data.state.trim().toLowerCase()),
          ne(places.id, id)
        )
      )
      .limit(1);
    if (dup.length > 0) {
      return { ok: false, error: `Another "${name}" already exists in ${data.state.trim()}.` };
    }

    await db
      .update(places)
      .set({
        name,
        state: data.state,
        district: data.district || null,
        category: data.category,
        placeType: data.placeType || null,
        description: data.description,
        shortDescription: data.shortDescription,
        imageUrl: data.imageUrl || null,
        openingTimings: data.openingTimings || null,
        entryFeePerPerson: data.entryFees,
        entryFeesForeigner: data.entryFeesForeigner ?? null,
        entryFeesChild: data.entryFeesChild ?? null,
        bookingUrl: data.bookingUrl || null,
        visitorGuidelines: data.visitorGuidelines || null,
        budgetPerDay: data.budgetPerDay,
        recommendedDays: data.recommendedDays,
        bestMonths: data.bestMonths || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        popularity: data.popularity ?? 50,
        isHidden: data.isHidden ?? false,
      })
      .where(eq(places.id, id));

    revalidatePath("/admin/places");
    revalidatePath(`/admin/places/${id}/edit`);
    revalidatePath("/admin/dashboard");
    revalidatePath("/destinations");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Could not save changes." };
  }
}

export async function deleteAdminPlace(id: string) {
  await requireAdmin();
  // No DB-level cascade is possible for place_images (polymorphic placeId/
  // placeType, not a real FK — see schema.ts) — clean up its gallery rows
  // at the app level before deleting the place itself. Any future delete
  // action for city_places/nearby_destinations must do the same for its
  // own placeType.
  await db.delete(placeImages).where(and(eq(placeImages.placeId, id), eq(placeImages.placeType, "destination")));
  await db.delete(places).where(eq(places.id, id));
  revalidatePath("/admin/places");
  revalidatePath("/admin/dashboard");
  revalidatePath("/destinations");
}
