// Contributor-tier badge shown on a post card, derived from the author's
// total post count (see getAuthorPostCounts in queries/communities.ts).
// Thresholds are an editorial choice, not a stored value — safe to tune.
export function getContributorTier(postCount: number): string | undefined {
  if (postCount >= 20) return "Top Contributor";
  if (postCount >= 5) return "Travel Enthusiast";
  if (postCount >= 2) return "Explorer";
  return "New Member";
}
