import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
(async () => {
  const { db } = await import("../../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const r = await db.execute(sql`
    SELECT name, slug FROM places
    WHERE lower(coalesce(state,'')) = 'tamil nadu'
      AND (name ILIKE '%moat' OR name ILIKE '%ramparts' OR name ILIKE '%courtyard'
        OR name ILIKE '%car street' OR name ILIKE '%temple streets' OR name ILIKE '%viewpoints'
        OR name ILIKE '%sunrise' OR name ILIKE '%bastion' OR name ILIKE '%granaries'
        OR name ILIKE '%hill steps' OR name ILIKE '%lake birding' OR name ILIKE '%hill tank'
        OR name ILIKE '%Valley View' OR name ILIKE '%waterfalls trail' OR name ILIKE '%Dargah tank'
        OR name ILIKE '%forest road')
    ORDER BY name`);
  const rows = (r.rows ?? r) as Record<string, unknown>[];
  console.log(`fragment-shaped rows now in Tamil Nadu: ${rows.length}`);
  for (const x of rows) console.log(`  ${x.name}   [${x.slug}]`);
  process.exit(0);
})();
