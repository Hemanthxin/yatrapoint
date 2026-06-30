import type { NewDestination } from "./schema";

import { karnatakaBengaluruRegion } from "./karnataka/group-a";
import { karnatakaMysuruRegion } from "./karnataka/group-b";
import { karnatakaMalnadRegion } from "./karnataka/group-c";
import { karnatakaCoastalRegion } from "./karnataka/group-d";
import { karnatakaKalyanaRegion } from "./karnataka/group-e";
import { karnatakaKitturRegion } from "./karnataka/group-f";

type SeedPlace = Omit<NewDestination, "id" | "createdAt">;

// Slugs already curated in seed-data.ts — skip them here so the canonical
// entries win and we don't insert two rows for the same place.
const RESERVED_SLUGS = new Set(["hampi", "coorg", "gokarna"]);

// Comprehensive Karnataka catalogue, assembled from the six geographic groups
// (one per agent / region) covering all 31 districts. Deduped by slug so a place
// can never be inserted twice even if two groups overlap on a border spot.
const ALL_GROUPS: SeedPlace[] = [
  ...karnatakaBengaluruRegion,
  ...karnatakaMysuruRegion,
  ...karnatakaMalnadRegion,
  ...karnatakaCoastalRegion,
  ...karnatakaKalyanaRegion,
  ...karnatakaKitturRegion,
];

const seen = new Set<string>();
export const karnatakaDestinations: SeedPlace[] = ALL_GROUPS.filter((p) => {
  if (RESERVED_SLUGS.has(p.slug) || seen.has(p.slug)) return false;
  seen.add(p.slug);
  return true;
});
