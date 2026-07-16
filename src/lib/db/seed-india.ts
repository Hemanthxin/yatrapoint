import type { NewDestination } from "./schema";

import { northIndiaDestinations } from "./india/north";
import { northwestIndiaDestinations } from "./india/northwest";
import { westIndiaDestinations } from "./india/west";
import { centralIndiaDestinations } from "./india/central";
import { eastIndiaDestinations } from "./india/east";
import { northeastIndiaDestinations } from "./india/northeast";
import { southIndiaDestinations } from "./india/south";
import { karnatakaExtraDestinations } from "./india/karnataka-extra";
import { karnatakaDestinations } from "./seed-karnataka";

type SeedPlace = Omit<NewDestination, "id" | "createdAt">;

// Slugs already curated in seed-data.ts (the 30 canonical pan-India picks) plus
// every slug in the main Karnataka catalogue (294 places) — skip them here so
// the canonical entries win and we never insert two rows for the same place.
const RESERVED_SLUGS = new Set<string>([
  ...karnatakaDestinations.map((d) => d.slug),
  "tirupati",
  "hampi",
  "munnar",
  "goa-north",
  "rishikesh",
  "varanasi",
  "jaipur",
  "udaipur",
  "manali",
  "ladakh-leh",
  "andaman-havelock",
  "coorg",
  "ooty",
  "khajuraho",
  "kaziranga",
  "ranthambore",
  "kanyakumari",
  "pondicherry",
  "darjeeling",
  "auli",
  "spiti",
  "gokarna",
  "tawang",
  "majuli",
  "chettinad",
  "dholavira",
  "mussoorie",
  "mahabaleshwar",
  "shirdi",
  "bodh-gaya",
]);

// Comprehensive pan-India catalogue, assembled from seven geographic groups
// (one per region) covering every state and union territory, plus a supplementary
// Karnataka batch on top of the main seed-karnataka.ts catalogue. Deduped by slug
// (against the reserved set and within itself) so a place can never be inserted
// twice even if two groups overlap on a border spot.
const ALL_GROUPS: SeedPlace[] = [
  ...northIndiaDestinations,
  ...northwestIndiaDestinations,
  ...westIndiaDestinations,
  ...centralIndiaDestinations,
  ...eastIndiaDestinations,
  ...northeastIndiaDestinations,
  ...southIndiaDestinations,
  ...karnatakaExtraDestinations,
];

const seen = new Set<string>();
export const indiaDestinations: SeedPlace[] = ALL_GROUPS.filter((p) => {
  if (RESERVED_SLUGS.has(p.slug) || seen.has(p.slug)) return false;
  seen.add(p.slug);
  return true;
});
