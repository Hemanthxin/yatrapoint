"use server";

import { revalidatePath } from "next/cache";
import { and, eq, count } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { placeImages } from "@/lib/db/schema";
import { isAdminSession } from "@/lib/admin";
import type { ImageSource } from "@/lib/queries/admin-images";
import { listGalleryImages, listGalleryImagesForPlaces, MAX_GALLERY_IMAGES, type GalleryImage } from "@/lib/queries/place-gallery";

// Separate, stricter cap than the legacy single-photo field's
// MAX_IMAGE_BYTES (2MB) — a place can have up to 4 of these, so each one
// needs to stay small or 4 images would cost roughly 4x what one photo did.
const MAX_GALLERY_IMAGE_BYTES = 600_000;

export interface GalleryActionResult {
  ok: boolean;
  error?: string;
  images?: GalleryImage[];
}

async function requireAdminOrDeny(): Promise<GalleryActionResult | null> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return { ok: false, error: "Not authorized." };
  return null;
}

function afterMutate() {
  revalidatePath("/admin/images");
}

// Thin server-action wrappers so the admin client component can read
// without pulling the DB client into its bundle.
export async function fetchPlaceGallery(placeType: ImageSource, placeId: string): Promise<GalleryImage[]> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return [];
  return listGalleryImages(placeId, placeType);
}

// Keyed by `${source}:${id}` — matches the convention already used across
// the admin Images screen (e.g. `key={`${row.source}:${row.id}`}`).
export async function fetchPlaceGalleriesBatch(
  items: { id: string; source: ImageSource }[]
): Promise<Record<string, GalleryImage[]>> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return {};
  const map = await listGalleryImagesForPlaces(items);
  const out: Record<string, GalleryImage[]> = {};
  for (const item of items) {
    out[`${item.source}:${item.id}`] = map.get(item.id) ?? [];
  }
  return out;
}

export async function addPlaceGalleryImage(
  placeType: ImageSource,
  placeId: string,
  url: string,
  caption: string | null
): Promise<GalleryActionResult> {
  const denied = await requireAdminOrDeny();
  if (denied) return denied;
  if (!url || url.length > MAX_GALLERY_IMAGE_BYTES) {
    return { ok: false, error: "Photo is too large — try a smaller one." };
  }

  try {
    // Re-check the cap server-side — never trust the client-hidden "Add"
    // slot alone (a second tab or a slow-network race could otherwise slip
    // in a 5th image).
    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(placeImages)
      .where(and(eq(placeImages.placeId, placeId), eq(placeImages.placeType, placeType)));
    if (existingCount >= MAX_GALLERY_IMAGES) {
      return { ok: false, error: `This place already has ${MAX_GALLERY_IMAGES} photos — delete one first.` };
    }

    await db.insert(placeImages).values({
      placeId,
      placeType,
      url,
      caption: caption?.trim() || null,
      position: existingCount,
    });
    afterMutate();
    const images = await listGalleryImages(placeId, placeType);
    return { ok: true, images };
  } catch {
    return { ok: false, error: "Could not save the photo." };
  }
}

export async function deletePlaceGalleryImage(imageId: string): Promise<GalleryActionResult> {
  const denied = await requireAdminOrDeny();
  if (denied) return denied;

  try {
    const [row] = await db
      .delete(placeImages)
      .where(eq(placeImages.id, imageId))
      .returning({ placeId: placeImages.placeId, placeType: placeImages.placeType });
    if (!row) return { ok: false, error: "Photo not found." };
    afterMutate();
    const images = await listGalleryImages(row.placeId, row.placeType as ImageSource);
    return { ok: true, images };
  } catch {
    return { ok: false, error: "Could not delete the photo." };
  }
}

export async function updatePlaceGalleryCaption(imageId: string, caption: string | null): Promise<GalleryActionResult> {
  const denied = await requireAdminOrDeny();
  if (denied) return denied;

  try {
    const [row] = await db
      .update(placeImages)
      .set({ caption: caption?.trim() || null })
      .where(eq(placeImages.id, imageId))
      .returning({ placeId: placeImages.placeId, placeType: placeImages.placeType });
    if (!row) return { ok: false, error: "Photo not found." };
    afterMutate();
    const images = await listGalleryImages(row.placeId, row.placeType as ImageSource);
    return { ok: true, images };
  } catch {
    return { ok: false, error: "Could not save the caption." };
  }
}

// Swaps `position` between two adjacent gallery rows — the up/down reorder
// buttons. Simplest possible contract for a max-4-item list.
export async function swapPlaceGalleryPosition(imageIdA: string, imageIdB: string): Promise<GalleryActionResult> {
  const denied = await requireAdminOrDeny();
  if (denied) return denied;

  try {
    const rows = await db
      .select({ id: placeImages.id, placeId: placeImages.placeId, placeType: placeImages.placeType, position: placeImages.position })
      .from(placeImages)
      .where(eq(placeImages.id, imageIdA));
    const [a] = rows;
    const [b] = await db
      .select({ id: placeImages.id, position: placeImages.position })
      .from(placeImages)
      .where(eq(placeImages.id, imageIdB));
    if (!a || !b) return { ok: false, error: "Photo not found." };

    await db.update(placeImages).set({ position: b.position }).where(eq(placeImages.id, a.id));
    await db.update(placeImages).set({ position: a.position }).where(eq(placeImages.id, b.id));
    afterMutate();
    const images = await listGalleryImages(a.placeId, a.placeType as ImageSource);
    return { ok: true, images };
  } catch {
    return { ok: false, error: "Could not reorder the photos." };
  }
}
