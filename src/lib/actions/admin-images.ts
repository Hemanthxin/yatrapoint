"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { destinations, nearbyDestinations, cityPlaces } from "@/lib/db/schema";
import { isAdminSession } from "@/lib/admin";
import { searchPlacesForImages, type AdminImageRow, type ImageSource } from "@/lib/queries/admin-images";

const MAX_IMAGE_BYTES = 2_000_000;

// Thin server-action wrapper so the admin client component can search
// without pulling the DB client into its bundle.
export async function searchPlaceImages(query: string): Promise<AdminImageRow[]> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return [];
  return searchPlacesForImages(query);
}

export interface UpdatePlaceImageResult {
  ok: boolean;
  error?: string;
}

// One lightweight, table-agnostic action: set/replace the photo for a place
// in whichever catalogue it lives in (destinations / nearby_destinations /
// city_places), then revalidate everywhere that place's image is shown on
// the public site.
export async function updatePlaceImage(
  source: ImageSource,
  id: string,
  imageUrl: string
): Promise<UpdatePlaceImageResult> {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) return { ok: false, error: "Not authorized." };
  if (!imageUrl || imageUrl.length > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Photo is too large — try a smaller one." };
  }

  try {
    if (source === "destination") {
      const [row] = await db
        .update(destinations)
        .set({ imageUrl })
        .where(eq(destinations.id, id))
        .returning({ slug: destinations.slug });
      if (!row) return { ok: false, error: "Place not found." };
      revalidatePath("/destinations");
      revalidatePath(`/destinations/${row.slug}`);
    } else if (source === "nearby") {
      const [row] = await db
        .update(nearbyDestinations)
        .set({ imageUrl })
        .where(eq(nearbyDestinations.id, id))
        .returning({ slug: nearbyDestinations.slug });
      if (!row) return { ok: false, error: "Place not found." };
      revalidatePath("/one-day-trips");
      revalidatePath(`/one-day-trips/${row.slug}`);
    } else {
      const [row] = await db
        .update(cityPlaces)
        .set({ imageUrl })
        .where(eq(cityPlaces.id, id))
        .returning({ slug: cityPlaces.slug });
      if (!row) return { ok: false, error: "Place not found." };
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
