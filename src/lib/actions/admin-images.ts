"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { isAdminSession } from "@/lib/admin";
import {
  searchPlacesForImages,
  listPlacesForImages,
  listImageFacets,
  type AdminImageRow,
  type ImageSource,
} from "@/lib/queries/admin-images";
import { PLACE_KINDS, kindsOf } from "@/lib/queries/places";

const MAX_IMAGE_BYTES = 2_000_000;

// Thin server-action wrappers so the admin client component can search and
// filter without pulling the DB client into its bundle.
export async function searchPlaceImages(
  query: string,
  filter: { state?: string; district?: string } = {}
): Promise<AdminImageRow[]> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return [];
  return searchPlacesForImages(query, filter);
}

// Used when a state or district is chosen with no search term: show that
// area's places that still need a photo, rather than an empty screen.
export async function filterPlaceImages(filter: {
  state?: string;
  district?: string;
  missingOnly?: boolean;
}): Promise<AdminImageRow[]> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return [];
  return listPlacesForImages({ ...filter, missingOnly: filter.missingOnly ?? true }, 45);
}

// Districts depend on the chosen state, so the client asks for them when it
// changes rather than shipping every district in the country up front.
export async function placeImageFacets(
  state?: string
): Promise<{ states: string[]; districts: string[] }> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return { states: [], districts: [] };
  return listImageFacets(state);
}

export interface UpdatePlaceImageResult {
  ok: boolean;
  error?: string;
}

// Set or replace the photo for a place. There is one row per place now, so
// this is a single update — and a photo added here shows up on every screen
// that place appears on, instead of only the catalogue whose copy was edited.
export async function updatePlaceImage(
  _source: ImageSource,
  id: string,
  imageUrl: string
): Promise<UpdatePlaceImageResult> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return { ok: false, error: "Not authorized." };
  if (!imageUrl || imageUrl.length > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Photo is too large — try a smaller one." };
  }

  try {
    const [row] = await db
      .update(places)
      .set({ imageUrl })
      .where(eq(places.id, id))
      .returning({ slug: places.slug, kinds: places.kinds });
    if (!row) return { ok: false, error: "Place not found." };

    // Revalidate every route this place is reachable through — a place can be
    // a destination AND a day trip AND a city listing at once.
    const kinds = kindsOf(row);
    if (kinds.includes(PLACE_KINDS.destination)) {
      revalidatePath("/destinations");
      revalidatePath(`/destinations/${row.slug}`);
    }
    if (kinds.includes(PLACE_KINDS.dayTrip)) {
      revalidatePath("/one-day-trips");
      revalidatePath(`/one-day-trips/${row.slug}`);
    }
    if (kinds.includes(PLACE_KINDS.city)) {
      revalidatePath("/explore-bangalore");
      revalidatePath(`/explore-bangalore/${row.slug}`);
    }
    revalidatePath("/dashboard");
    revalidatePath("/admin/images");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save the photo." };
  }
}
