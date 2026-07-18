// One-off data cleanup for the destinations catalogue, driven by the issues
// flagged in Book1.xlsx:
//   1. Remove permanently-closed places.
//   2. Merge duplicate rows for the same physical place (same name, same spot)
//      that appeared because an older auto-import and the new curated seed used
//      different slugs — this is the "same place shows multiple locations" bug.
//   3. Standardise inconsistent state spellings.
//   4. Un-hide a place that wasn't displaying.
//
// SAFE: every row that gets deleted or modified is backed up to
// exports/cleanup-backup-<ts>.json before any write, so the change is
// reversible. Run: npx tsx scripts/cleanup-destinations.ts
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import fs from "node:fs";
import path from "node:path";

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const isAuto = (d: string | null) =>
  !!d && (/Best time to visit:/.test(d) || /Significance:/.test(d));
const richness = (r: any) =>
  (r.description?.length ?? 0) +
  (r.openingTimings ? 200 : 0) +
  (r.bestMonths ? 100 : 0) +
  (r.entryFees ? 20 : 0) +
  (isAuto(r.description) ? -1000 : 0);

// Permanently closed / to remove (from Book1 Sheet2 "closed" + Sheet1 notes).
const CLOSED_SLUGS = [
  "muddenahalli",
  "chunchi-falls",
  "naida-caves",
  "dr-salim-ali-bird-santuary",
  "matsyadarshini-aquarium",
];

// Canonical state spellings.
const STATE_FIXES: Record<string, string> = {
  Maharastra: "Maharashtra",
  "Andaman & Nicobar": "Andaman & Nicobar Islands",
  "Andaman and Nicobar Islands": "Andaman & Nicobar Islands",
  "Jammu and Kashmir": "Jammu & Kashmir",
  KARNATAKA: "Karnataka",
  karnataka: "Karnataka",
};

async function run() {
  const { db } = await import("../src/lib/db");
  const { destinations } = await import("../src/lib/db/schema");
  const { eq, inArray } = await import("drizzle-orm");

  const all = await db.select().from(destinations);
  console.log(`Loaded ${all.length} destinations.`);

  // --- Decide duplicate drops: group by name, pair within 25km ---
  const byName = new Map<string, typeof all>();
  for (const r of all) {
    const k = r.name.trim().toLowerCase();
    if (!byName.has(k)) byName.set(k, [] as any);
    (byName.get(k) as any).push(r);
  }
  const dropDupSlugs = new Set<string>();
  const mergeLog: string[] = [];
  for (const [, group] of byName) {
    if (group.length < 2) continue;
    // Cluster members that are within 25km of each other (same physical place).
    const used = new Set<number>();
    for (let i = 0; i < group.length; i++) {
      if (used.has(i)) continue;
      const cluster = [group[i]];
      used.add(i);
      for (let j = i + 1; j < group.length; j++) {
        if (used.has(j)) continue;
        const km = haversineKm(
          [Number(group[i].latitude), Number(group[i].longitude)],
          [Number(group[j].latitude), Number(group[j].longitude)]
        );
        if (km <= 25) {
          cluster.push(group[j]);
          used.add(j);
        }
      }
      if (cluster.length > 1) {
        // Keep the richest (curated) row; drop the rest.
        cluster.sort((a, b) => richness(b) - richness(a));
        const keep = cluster[0];
        for (const drop of cluster.slice(1)) {
          if (CLOSED_SLUGS.includes(drop.slug)) continue; // handled separately
          dropDupSlugs.add(drop.slug);
          mergeLog.push(`  "${keep.name}": keep ${keep.slug} <- drop ${drop.slug}`);
        }
      }
    }
  }

  // --- State standardisation targets ---
  const stateUpdates = all.filter(
    (r) => STATE_FIXES[r.state] && !CLOSED_SLUGS.includes(r.slug) && !dropDupSlugs.has(r.slug)
  );

  // --- Un-hide Ayyanakere Lake (flagged "NOT DISPLAYED") ---
  const unhideSlugs = ["ayyanakere-lake"];

  // ---------- BACKUP ----------
  const affected = all.filter(
    (r) =>
      CLOSED_SLUGS.includes(r.slug) ||
      dropDupSlugs.has(r.slug) ||
      STATE_FIXES[r.state] ||
      unhideSlugs.includes(r.slug)
  );
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const backupPath = path.join(process.cwd(), "exports", `cleanup-backup-${stamp}.json`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(affected, null, 2));
  console.log(`\nBacked up ${affected.length} affected rows -> ${backupPath}`);

  console.log(`\n=== Plan ===`);
  console.log(`Closed to remove:        ${CLOSED_SLUGS.length}`);
  console.log(`Duplicate rows to drop:  ${dropDupSlugs.size}`);
  console.log(`State fixes:             ${stateUpdates.length}`);
  console.log(`Un-hide:                 ${unhideSlugs.length}`);
  console.log(`\nMerges:\n${mergeLog.join("\n")}`);

  // ---------- EXECUTE ----------
  // 1) Delete closed + duplicate rows.
  const toDelete = [...new Set([...CLOSED_SLUGS, ...dropDupSlugs])];
  // Only delete slugs that actually exist.
  const existing = new Set(all.map((r) => r.slug));
  const deletable = toDelete.filter((s) => existing.has(s));
  for (let i = 0; i < deletable.length; i += 50) {
    await db.delete(destinations).where(inArray(destinations.slug, deletable.slice(i, i + 50)));
  }
  console.log(`\nDeleted ${deletable.length} rows (closed + duplicates).`);

  // 2) Standardise states.
  let stateFixed = 0;
  for (const [bad, good] of Object.entries(STATE_FIXES)) {
    const res = await db
      .update(destinations)
      .set({ state: good })
      .where(eq(destinations.state, bad));
    stateFixed += (res as any).rowCount ?? 0;
  }
  console.log(`Standardised state names (bad spellings -> canonical).`);

  // 3) Un-hide flagged places.
  for (const s of unhideSlugs) {
    if (existing.has(s)) await db.update(destinations).set({ isHidden: false }).where(eq(destinations.slug, s));
  }
  console.log(`Un-hid ${unhideSlugs.length} place(s).`);

  // ---------- VERIFY ----------
  const after = await db.select().from(destinations);
  const nameCount = new Map<string, number>();
  for (const r of after) nameCount.set(r.name, (nameCount.get(r.name) ?? 0) + 1);
  const remainingDupNames = [...nameCount.entries()].filter(([, n]) => n > 1);
  console.log(`\n=== After ===`);
  console.log(`Total destinations: ${after.length}`);
  console.log(`Remaining duplicate names: ${remainingDupNames.length}`);
  for (const [n, c] of remainingDupNames) console.log(`  ${c}x ${n}`);
  const states = [...new Set(after.map((r) => r.state))].sort();
  console.log(`Distinct states now: ${states.length}`);
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
