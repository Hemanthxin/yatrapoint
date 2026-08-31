import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { readFileSync, existsSync } from "node:fs";

// Deletes the duplicate rows inside the city catalogue that are safe to delete.
//
//   npx tsx scripts/merge/remove-city-dupes.ts           # dry run
//   npx tsx scripts/merge/remove-city-dupes.ts --write   # apply
//
// Run scripts/merge/plan-city-dedup.ts first to produce city-dupes.json.
//
// Only clusters whose members share the SAME NAME are deleted. That is where
// the risk actually lives: a partial-name match is what pairs "Avalahalli Lake"
// with "Avalahalli Masjid" and "Prince of Peace Disciples Church" with "Peace
// Restaurant" — a lake and a mosque, a church and a restaurant. An identical
// name that only three rows in the entire catalogue carry is an identity, not a
// coincidence. Those partial matches are reported and left alone.
//
// A 1 km ceiling on top of that: two records of one place disagree by a few
// hundred metres, but two branches of a small local chain can share a name a
// couple of kilometres apart, and nothing in the data separates them.

const WRITE = process.argv.includes("--write");
const PLAN = "scripts/merge/city-dupes.json";
const MAX_KM = 1;

interface Row { id: string; name: string; slug: string; lat: number; lng: number; area: string | null }
interface Cluster { keep: Row; remove: Row[] }

const HONORIFICS = new Set(["sri", "shri", "sree", "shree", "st", "saint", "the"]);
const squash = (s: string) =>
  s.replace(/\([^)]*\)/g, " ").toLowerCase().replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/).filter((t) => t && !HONORIFICS.has(t)).join("");

function km(a: Row, b: Row) {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function run() {
  if (!existsSync(PLAN)) throw new Error(`${PLAN} not found — run plan-city-dedup.ts first.`);
  const plan = JSON.parse(readFileSync(PLAN, "utf8")) as { safe: Cluster[]; review: Cluster[] };
  const all = [...plan.safe, ...plan.review];

  const sameName = (c: Cluster) => c.remove.every((r) => squash(r.name) === squash(c.keep.name));
  const close = (c: Cluster) => c.remove.every((r) => km(c.keep, r) <= MAX_KM);

  const eligible = all.filter((c) => sameName(c) && close(c));
  const kept = all.filter((c) => !(sameName(c) && close(c)));

  const { db } = await import("../../src/lib/db");
  const { sql } = await import("drizzle-orm");
  if (eligible.length === 0) {
    console.log("nothing eligible");
    return;
  }

  // WHICH row survives is decided here, from the data — not from the order the
  // planner happened to emit. The two sources are not equal: the curated seed
  // rows carry a real description, an area and a photo, while the bulk OSM
  // rows carry a generated stub ("X is a park in Bengaluru, sourced from
  // OpenStreetMap") and no image. Keeping whichever came first would have
  // thrown away the good row for Coles Park, Esteem Mall and Big Pitcher.
  const allIds = eligible.flatMap((c) => [c.keep.id, ...c.remove.map((r) => r.id)]);
  const detailRes = await db.execute(sql`
    SELECT id, slug, name, area, image_url, description, google_rating, google_place_id,
           entry_fee_per_person, legacy_slugs
    FROM places WHERE id IN (${sql.join(allIds.map((i) => sql`${i}`), sql`, `)})`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detail = new Map<string, Record<string, unknown>>(
    (((detailRes as any).rows ?? detailRes) as Record<string, unknown>[]).map((r) => [String(r.id), r])
  );

  const OSM_SLUG = /-(node|way|relation)-\d+$/i;
  const OSM_STUB = /sourced from OpenStreetMap/i;
  const score = (id: string): number => {
    const r = detail.get(id);
    if (!r) return -1;
    const desc = String(r.description ?? "");
    let s = 0;
    if (r.image_url) s += 40; // a photo is the single biggest thing to lose
    if (r.area) s += 20;
    if (!OSM_SLUG.test(String(r.slug))) s += 15; // hand-authored, not imported
    if (!OSM_STUB.test(desc)) s += 15; // a real description, not a generated one
    if (r.google_place_id) s += 5;
    if (r.google_rating != null) s += 3;
    if (Number(r.entry_fee_per_person ?? 0) > 0) s += 2;
    s += Math.min(desc.length, 400) / 100; // longer prose breaks ties
    return s;
  };

  const doomed = eligible.map((c) => {
    const members = [c.keep, ...c.remove].sort((a, b) => score(b.id) - score(a.id));
    return { keep: members[0], remove: members.slice(1) };
  });

  const ids = doomed.flatMap((c) => c.remove.map((r) => r.id));
  console.log(`clusters in the report:        ${all.length}`);
  console.log(`same name AND within ${MAX_KM} km:   ${doomed.length}  (${ids.length} rows to delete)`);
  console.log(`left alone for review:         ${kept.length}\n`);
  for (const c of doomed) {
    const k = detail.get(c.keep.id);
    const rich = `img=${k?.image_url ? "y" : "n"} desc=${String(k?.description ?? "").length}`;
    console.log(`  keep ${String(k?.slug).padEnd(40)} [${rich}]  delete ${c.remove.map((r) => `${detail.get(r.id)?.slug} (img=${detail.get(r.id)?.image_url ? "y" : "n"} desc=${String(detail.get(r.id)?.description ?? "").length})`).join(", ")}`);
  }
  const list = sql.join(ids.map((i) => sql`${i}`), sql`, `);

  // Nothing may be deleted while something still points at it.
  const q = async (s: ReturnType<typeof sql>) => {
    const r = await db.execute(s);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((r as any).rows ?? r)[0] as Record<string, unknown>;
  };
  const gallery = await q(sql`SELECT count(*)::int AS n FROM place_images WHERE place_id IN (${list})`);
  const favs = await q(sql`SELECT count(*)::int AS n FROM favorites WHERE destination_id IN (${list})`);
  const items = await q(sql`SELECT count(*)::int AS n FROM trip_plan_items WHERE destination_id IN (${list})`);
  console.log(`\ndependents on the rows to delete: gallery ${gallery.n}, favourites ${favs.n}, trip-plan items ${items.n}`);

  if (!WRITE) {
    console.log("\nDRY RUN — nothing written. Re-run with --write to apply.");
    return;
  }

  await db.execute(sql`DELETE FROM place_images WHERE place_id IN (${list})`);
  await db.execute(sql`DELETE FROM places WHERE id IN (${list})`);
  // Also from the source table, so re-running the merge cannot resurrect them.
  await db.execute(sql`DELETE FROM city_places WHERE id IN (${list})`);
  const after = await q(sql`SELECT count(*)::int AS n FROM places`);
  console.log(`\ndeleted ${ids.length} rows. places now: ${after.n}`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
