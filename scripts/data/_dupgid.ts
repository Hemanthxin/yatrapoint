import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
(async () => {
  const { db } = await import("../../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const r = await db.execute(sql`
    SELECT google_place_id, count(*) AS n,
           string_agg(name || ' [' || slug || ', desc:' || length(description) || ', pop:' || popularity || ']', '  |  ' ORDER BY length(description) DESC) AS rows
    FROM places
    WHERE google_place_id IS NOT NULL AND google_place_id <> ''
    GROUP BY google_place_id HAVING count(*) > 1
    ORDER BY n DESC`);
  const rows = (r.rows ?? r) as Array<Record<string, string>>;
  console.log(`places sharing a google_place_id: ${rows.length} groups`);
  for (const x of rows) console.log(`  ${x.rows}`);
  process.exit(0);
})();
