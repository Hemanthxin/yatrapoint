// Exports every table in the database to a single Excel workbook,
// one sheet per table. Run: npm run db:export
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { placeMapUrl } from "../src/lib/maps";

// Tables whose rows represent a real place — we add a ready-to-click
// google_maps_link column that opens the exact named place (not a raw pin).
const PLACE_TABLES = new Set([
  "destinations",
  "nearby_destinations",
  "city_places",
  "hotels",
]);

async function run() {
  const { db } = await import("../src/lib/db");
  const schema = await import("../src/lib/db/schema");

  // Every exported pgTable in the schema, keyed by the sheet name we want.
  const tables: Record<string, any> = {
    users: schema.users,
    accounts: schema.accounts,
    sessions: schema.sessions,
    verification_tokens: schema.verificationTokens,
    otp_codes: schema.otpCodes,
    destinations: schema.destinations,
    trip_plans: schema.tripPlans,
    trip_plan_items: schema.tripPlanItems,
    favorites: schema.favorites,
    nearby_destinations: schema.nearbyDestinations,
    city_places: schema.cityPlaces,
    community_posts: schema.communityPosts,
    community_reactions: schema.communityReactions,
    community_comments: schema.communityComments,
    hotels: schema.hotels,
    announcements: schema.announcements,
  };

  const wb = XLSX.utils.book_new();

  for (const [name, table] of Object.entries(tables)) {
    process.stdout.write(`Exporting ${name} ... `);
    let rows: any[] = [];
    try {
      rows = await db.select().from(table);
    } catch (err) {
      console.log(`SKIPPED (${(err as Error).message})`);
      continue;
    }

    // Flatten values (Dates -> ISO strings) so Excel renders them cleanly.
    const flat = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        let val: unknown = v instanceof Date ? v.toISOString() : v;
        // Excel caps a cell at 32767 chars; clamp so writeFile can't throw.
        if (typeof val === "string" && val.length > 32767) {
          val = val.slice(0, 32764) + "...";
        }
        o[k] = val;
      }
      // Give every place row a link that opens the exact named place in Maps.
      if (PLACE_TABLES.has(name)) {
        o.google_maps_link = placeMapUrl(r as any);
      }
      return o;
    });

    const ws =
      flat.length > 0
        ? XLSX.utils.json_to_sheet(flat)
        : XLSX.utils.aoa_to_sheet([Object.keys((table as any) ?? {})]);

    // Excel sheet names max 31 chars and can't contain some symbols.
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    console.log(`${rows.length} rows`);
  }

  const outDir = path.join(process.cwd(), "exports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const outPath = path.join(outDir, `yatra-point-db-${stamp}.xlsx`);
  XLSX.writeFile(wb, outPath);

  console.log(`\nWrote ${outPath}`);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
