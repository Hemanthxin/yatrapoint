"use server";

import { wikiImage } from "@/lib/wiki";

// Resolve a real, name-matched photo for a place (from Wikipedia). Callable from
// the client <PlaceImage>. Returns null when Wikipedia has no image, so the
// component falls back to a neutral photo / gradient.
export async function resolvePlaceImage(name: string): Promise<string | null> {
  if (!name?.trim()) return null;
  return wikiImage(name);
}
