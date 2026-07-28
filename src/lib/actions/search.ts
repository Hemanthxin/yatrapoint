"use server";

import { auth } from "@/auth";
import type { CommunityPost } from "@/lib/db/schema";
import { getFeedSocial, type PostSocial } from "@/lib/queries/community";
import { searchUsers, searchPosts, searchByHashtag, type UserResult } from "@/lib/queries/search";

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
