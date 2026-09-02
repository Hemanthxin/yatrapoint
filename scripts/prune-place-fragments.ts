/**
 * Remove catalogue rows that are a PART of another catalogue row.
 *
 * An import can let these through — "Vellore fort museum courtyard" beside
 * "Vellore fort", "Chettinad old streets" beside "Chettinad" — and each one
 * then gets its own page and its own search result for something that is not a
 * separate destination.
 *
 * A row is only deleted when BOTH hold:
 *   - isFragment() recognises it as a part (see scripts/lib/place-match.ts),
 *     which itself requires a descriptor ending AND a resolvable parent; and
 *   - that parent exists as its own row in the same state.
 *
 * The second condition is the safety net. Without it the only record of a
 * place could be deleted because its name happened to end in "street".
 *
 *   npx tsx scripts/prune-place-fragments.ts --state "Tamil Nadu"
 *   npx tsx scripts/prune-place-fragments.ts --state "Tamil Nadu" --write
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { nameKey, isFragment } from "./lib/place-match";

const WRITE = process.argv.includes("--write");
const STATE = (() => {
  const i = process.argv.indexOf("--state");
  return i > -1 ? process.argv[i + 1] : "";
})();

if (!STATE) {
  console.error('Missing --state. Example: --state "Tamil Nadu"');
  process.exit(1);
}

async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  const r = await db.execute(sql`
    SELECT slug, name FROM places
    WHERE lower(coalesce(state, '')) = ${STATE.toLowerCase()}
  `);
  const rows = (r.rows ?? r) as Array<{ slug: string; name: string }>;
  const byKey = new Map(rows.map((x) => [nameKey(x.name), x]));
  const isKnown = (c: string) => byKey.has(nameKey(c));

  const doomed: Array<{ slug: string; name: string; parent: string }> = [];
  for (const x of rows) {
    const parent = isFragment(x.name, isKnown);
    if (parent && byKey.has(nameKey(parent))) doomed.push({ ...x, parent });
  }

  console.log(`${STATE}: ${rows.length} rows, ${doomed.length} are a part of another row`);
  for (const d of doomed) console.log(`  ${d.name}   is part of   ${d.parent}`);

  if (!WRITE) {
    console.log("\nDRY RUN — pass --write to delete.");
    process.exit(0);
  }

  for (const d of doomed) {
    await db.execute(sql`DELETE FROM places WHERE slug = ${d.slug}`);
  }
  console.log(`\nDeleted ${doomed.length}.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
