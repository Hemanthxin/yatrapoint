// Rewrites Book1.xlsx from the cleaned destinations table so the workbook the
// user annotated now reflects the fixes (closed places removed, duplicates
// merged, states standardised, map links rebuilt accurately). Two sheets:
//   - "Destinations": the full cleaned catalogue (same columns as before + a
//     correct google_maps_link rebuilt from each row's own name + coordinates).
//   - "Cleanup Log": every row that was removed, with the reason.
// Run: npx tsx scripts/regenerate-book1.ts
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { placeMapUrl } from "../src/lib/maps";

const CLOSED_SLUGS = new Set([
  "muddenahalli",
  "chunchi-falls",
  "naida-caves",
  "dr-salim-ali-bird-santuary",
  "matsyadarshini-aquarium",
]);

async function run() {
  const { db } = await import("../src/lib/db");
  const { destinations } = await import("../src/lib/db/schema");
  const { asc } = await import("drizzle-orm");

  const rows = await db
    .select()
    .from(destinations)
    .orderBy(asc(destinations.state), asc(destinations.district), asc(destinations.name));

  const flat = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      let val: unknown = v instanceof Date ? v.toISOString() : v;
      // Excel caps a cell at 32767 chars.
      if (typeof val === "string" && val.length > 32767) val = val.slice(0, 32764) + "...";
      o[k] = val;
    }
    // Rebuild the map link from THIS row's own name + coords (fixes any stale/
    // mismatched links, e.g. an Ooty row that used to point at Coorg).
    o.google_maps_link = placeMapUrl(r as any);
    return o;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(flat);
  ws["!cols"] = Object.keys(flat[0] ?? {}).map((k) =>
    k === "description"
      ? { wch: 80 }
      : k === "google_maps_link"
      ? { wch: 60 }
      : k === "shortDescription"
      ? { wch: 50 }
      : { wch: 18 }
  );
  XLSX.utils.book_append_sheet(wb, ws, "Destinations");

  // Cleanup log — read the most recent backup and mark which rows are gone.
  const exportsDir = path.join(process.cwd(), "exports");
  const backups = fs
    .readdirSync(exportsDir)
    .filter((f) => f.startsWith("cleanup-backup-") && f.endsWith(".json"))
    .sort();
  const log: any[] = [];
  if (backups.length) {
    const latest = JSON.parse(
      fs.readFileSync(path.join(exportsDir, backups[backups.length - 1]), "utf8")
    );
    const liveSlugs = new Set(rows.map((r) => r.slug));
    for (const b of latest) {
      if (!liveSlugs.has(b.slug)) {
        log.push({
          Action: "Removed",
          Reason: CLOSED_SLUGS.has(b.slug) ? "Permanently closed" : "Duplicate (merged into curated entry)",
          slug: b.slug,
          name: b.name,
          state: b.state,
          district: b.district,
          latitude: b.latitude,
          longitude: b.longitude,
        });
      }
    }
  }
  if (log.length) {
    const wsLog = XLSX.utils.json_to_sheet(log);
    wsLog["!cols"] = [
      { wch: 10 },
      { wch: 38 },
      { wch: 30 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLog, "Cleanup Log");
  }

  const out = path.join(process.cwd(), "Book1.xlsx");
  XLSX.writeFile(wb, out);
  console.log(`Wrote ${rows.length} destinations + ${log.length} cleanup-log rows to ${out}`);
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
