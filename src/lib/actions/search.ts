"use server";

import { auth } from "@/auth";
import type { CommunityPost } from "@/lib/db/schema";
import { getFeedSocial, type PostSocial } from "@/lib/queries/community";
import { searchUsers, searchPosts, searchByHashtag, type UserResult } from "@/lib/queries/search";
import { db } from "@/lib/db";
import { searchPlaces, kindsOf, PLACE_KINDS } from "@/lib/queries/places";

export interface SearchResult {
  users: UserResult[];
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
}

export async function searchCommunity(query: string): Promise<SearchResult> {
  const q = query.trim();
  if (!q) return { users: [], posts: [], social: {} };

  const session = await auth();
  const [users, posts] = await Promise.all([
    q.startsWith("#") ? Promise.resolve([]) : searchUsers(q),
    q.startsWith("#") ? searchByHashtag(q) : searchPosts(q),
  ]);
  const social = await getFeedSocial(posts.map((p) => p.id), session?.user?.id ?? "");
  return { users, posts, social };
}

export interface SearchSuggestion {
  id: string;
  name: string;
  category: string | null;
  // District/city/area, whichever this place actually has — a short
  // "where is this" line under the name.
  area: string | null;
  href: string;
}

// Detail-page route for a catalogue place, by which table it came from —
// same convention as the dashboard's NearbyPlaces widget (hrefFor there).
function hrefFor(slug: string, kinds: ReturnType<typeof kindsOf>): string {
  if (kinds.includes(PLACE_KINDS.destination)) return `/destinations/${slug}`;
  if (kinds.includes(PLACE_KINDS.dayTrip)) return `/one-day-trips/${slug}`;
  return `/explore-bangalore/${slug}`;
}

// Top-nav search-as-you-type. Deliberately lean — no imageUrl (the
// catalogue stores images as inline base64 text; the nearby-places and
// multi-stop-plan routes both had to be fixed earlier for exactly this
// reason, after pulling it for every candidate made those queries take
// 8-20s). A typeahead box can fire on every keystroke, so this only ever
// selects/returns the few plain-text fields an autocomplete row needs.
export async function searchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (q.length === 0) return [];

  const results = await searchPlaces(db, q, { limit: 6 });
  return results.map(({ place }) => {
    const kinds = kindsOf(place);
    return {
      id: place.id,
      name: place.name,
      category: place.category,
      area: [place.area, place.district, place.state].filter(Boolean)[0] ?? null,
      href: hrefFor(place.slug, kinds),
    };
  });
}
