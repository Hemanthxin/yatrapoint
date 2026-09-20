/**
 * How far along is the geocoding?
 *
 * Both geocoding scripts are resumable — they only ever look at rows where
 * latitude is null — so the work survives the machine being switched off, but
 * it does NOT continue on its own. This prints what is done and what is left.
 *
 *   npm run geocode:status
 *   npm run geocode          # resume: Photon pass, then Nominatim for the rest
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const STATES = ["Karnataka", "Tamil Nadu", "Kerala", "Maharashtra", "Andhra Pradesh", "Telangana"];

async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  const res = await db.execute(sql`
    SELECT state,
           count(*) AS total,
           count(*) FILTER (WHERE latitude IS NOT NULL) AS pinned
    FROM places
    WHERE state IS NOT NULL
    GROUP BY state
  `);
  const rows = (res.rows ?? res) as Array<{ state: string; total: string; pinned: string }>;
  const byState = new Map(rows.map((r) => [r.state.toLowerCase(), r]));

  let total = 0;
  let pinned = 0;
  console.log("");
  for (const s of STATES) {
    const r = byState.get(s.toLowerCase());
    if (!r) continue;
    const t = Number(r.total);
    const p = Number(r.pinned);
    total += t;
    pinned += p;
    const pct = Math.round((p / t) * 100);
    const bar = "#".repeat(Math.round(pct / 4)).padEnd(25, ".");
    console.log(`  ${s.padEnd(16)} ${bar} ${String(p).padStart(5)}/${String(t).padEnd(5)} ${String(pct).padStart(3)}%`);
  }
  const pct = total ? Math.round((pinned / total) * 100) : 0;
  console.log(`  ${"TOTAL".padEnd(16)} ${"".padEnd(25)} ${pinned}/${total}  ${pct}%`);
  console.log(`\n  ${total - pinned} places still need a pin. Run: npm run geocode\n`);

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
