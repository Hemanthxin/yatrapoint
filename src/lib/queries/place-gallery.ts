import { and, eq, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { placeImages } from "@/lib/db/schema";
import type { ImageSource } from "@/lib/queries/admin-images";
import { MAX_GALLERY_IMAGES } from "@/lib/gallery-constants";

export { MAX_GALLERY_IMAGES };

export interface GalleryImage {
  id: string;
  url: string;
  caption: string | null;
  position: number;
}

// Gallery for a single place — used by the admin manager when editing one
// card's photos.
export async function listGalleryImages(placeId: string, placeType: ImageSource): Promise<GalleryImage[]> {
  const rows = await db
    .select({ id: placeImages.id, url: placeImages.url, caption: placeImages.caption, position: placeImages.position })
    .from(placeImages)
    .where(and(eq(placeImages.placeId, placeId), eq(placeImages.placeType, placeType)))
    .orderBy(asc(placeImages.position));
  return rows;
}

// Batched gallery lookup for many places at once — 3 queries total (one per
// placeType via inArray), not one query per place. Used by both the admin
// list screen (avoid N+1 across ~15-45 visible cards) and the public
// multi-stop plan API (avoid N+1 across a plan's stops + alternatives).
export async function listGalleryImagesForPlaces(
  items: { id: string; source: ImageSource }[]
): Promise<Map<string, GalleryImage[]>> {
  const result = new Map<string, GalleryImage[]>();
  if (items.length === 0) return result;

  const bySource = new Map<ImageSource, string[]>();
  for (const item of items) {
    const list = bySource.get(item.source) ?? [];
    list.push(item.id);
    bySource.set(item.source, list);
  }

  const rowSets = await Promise.all(
    [...bySource.entries()].map(([source, ids]) =>
      db
        .select({
          placeId: placeImages.placeId,
          id: placeImages.id,
          url: placeImages.url,
          caption: placeImages.caption,
          position: placeImages.position,
        })
        .from(placeImages)
        .where(and(eq(placeImages.placeType, source), inArray(placeImages.placeId, ids)))
        .orderBy(asc(placeImages.position))
    )
  );

  for (const rows of rowSets) {
    for (const row of rows) {
      const list = result.get(row.placeId) ?? [];
      list.push({ id: row.id, url: row.url, caption: row.caption, position: row.position });
      result.set(row.placeId, list);
    }
  }
  return result;
}
