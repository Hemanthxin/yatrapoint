// One-off validator for the new all-India catalogue. Run: npx tsx scripts/validate-india.ts
import { indiaDestinations } from "../src/lib/db/seed-india";
import { seedDestinations } from "../src/lib/db/seed-data";
import { karnatakaDestinations } from "../src/lib/db/seed-karnataka";

const VALID_CATEGORIES = new Set([
  "pilgrimage",
  "adventure",
  "beach",
  "hill_station",
  "heritage",
  "wildlife",
]);

const problems: string[] = [];
const slugs = new Set<string>();
const perState = new Map<string, number>();

for (const d of indiaDestinations) {
  if (!d.slug || !/^[a-z0-9-]+$/.test(d.slug)) problems.push(`bad slug: ${d.slug}`);
  if (slugs.has(d.slug)) problems.push(`dup slug: ${d.slug}`);
  slugs.add(d.slug);
  if (!VALID_CATEGORIES.has(d.category)) problems.push(`bad category "${d.category}" on ${d.slug}`);
  if (!d.name) problems.push(`missing name: ${d.slug}`);
  if (!d.state) problems.push(`missing state: ${d.slug}`);
  if (!d.description) problems.push(`missing description: ${d.slug}`);
  if (!d.shortDescription) problems.push(`missing shortDescription: ${d.slug}`);
  if (d.shortDescription && d.shortDescription.length > 220)
    problems.push(`shortDescription too long (${d.shortDescription.length}): ${d.slug}`);
  if (typeof d.budgetPerDay !== "number" || d.budgetPerDay <= 0)
    problems.push(`bad budgetPerDay on ${d.slug}`);
  if (typeof d.entryFees !== "number" || d.entryFees < 0)
    problems.push(`bad entryFees on ${d.slug}`);
  const lat = Number(d.latitude);
  const lng = Number(d.longitude);
  if (!Number.isFinite(lat) || lat < 6 || lat > 37) problems.push(`suspicious lat ${d.latitude} on ${d.slug}`);
  if (!Number.isFinite(lng) || lng < 68 || lng > 98) problems.push(`suspicious lng ${d.longitude} on ${d.slug}`);
  perState.set(d.state, (perState.get(d.state) ?? 0) + 1);
}

// Overlap with existing canonical catalogues (should be 0 after dedupe).
const existing = new Set([...seedDestinations, ...karnatakaDestinations].map((d) => d.slug));
const overlap = [...slugs].filter((s) => existing.has(s));
if (overlap.length) problems.push(`overlap with existing slugs: ${overlap.join(", ")}`);

console.log(`New India destinations: ${indiaDestinations.length}`);
console.log(`Existing (curated + Karnataka): ${existing.size}`);
console.log(`Grand total after merge: ${existing.size + indiaDestinations.length}`);
console.log("\nPer state/UT:");
for (const [s, n] of [...perState.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s.padEnd(30)} ${n}`);
}

if (problems.length) {
  console.log(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems.slice(0, 60)) console.log("  - " + p);
  process.exit(1);
} else {
  console.log("\nAll rows valid. ✅");
}
