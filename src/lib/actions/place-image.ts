"use server";

import { wikiImage } from "@/lib/wiki";

// Resolve a real, name-matched photo for a place (from Wikipedia), using the
// location hint to disambiguate generic names. Callable from the client
// <PlaceImage>. Returns null when Wikipedia has nothing, so the component falls
// back to a category-relevant photo / gradient.
export async function resolvePlaceImage(name: string, hint?: string): Promise<string | null> {
  if (!name?.trim()) return null;
  return wikiImage(name, hint);
}
