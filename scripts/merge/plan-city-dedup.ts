import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { mkdirSync, writeFileSync } from "node:fs";

// Finds duplicates INSIDE the bulk-seeded city catalogue — the ones the
// cross-table merge deliberately left alone.
//
//   npx tsx scripts/merge/plan-city-dedup.ts
//
// Writes a reviewable report. Never touches the database.
//
// This is the hard half of the de-duplication problem. Those rows came from a
// bulk OpenStreetMap import, so most repeated names are NOT duplicates: there
// are 77 Domino's, 46 Cafe Coffee Days and 20 "Shiva Temple" in Bengaluru, and
// every one is a real, separate place. An earlier attempt that merged on name
// alone would have deleted ~300 of them. But genuine duplicates are in there
// too — Lumbini Gardens was stored twice, once from a curated seed and once
// from an OSM way, 1.7 km apart.
//
// What separates the two is how RARE the name is across the whole catalogue. A
// name carried by dozens of rows is a brand or a generic; a name carried by two
// is an identity. That, plus a tight distance and a cap on cluster size, is the
// whole rule.

type Row = { id: string; name: string; slug: string; lat: number; lng: number; area: string | null };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const HONORIFICS = new Set(["sri", "shri", "sree", "shree", "st", "saint", "the"]);
const squash = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter((t) => t && !HONORIFICS.has(t)).join("");
const tokens = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter((t) => t.length > 1));

// Words that describe what a place IS, never which one it is.
const GENERIC = new Set([
  "temple", "mandir", "devasthana", "devalaya", "shrine", "math", "matha", "mutt",
  "swamy", "swami", "sri", "shri", "sree", "shree", "st", "saint", "the", "and", "of",
  "park", "garden", "gardens", "lake", "tank", "fort", "palace", "museum", "falls",
  "hills", "hill", "betta", "church", "cathedral", "mosque", "masjid", "restaurant",
  "hotel", "bar", "cafe", "coffee", "canteen", "store", "shop", "mall", "market",
  "centre", "center", "point", "view", "viewpoint", "road", "circle", "cross",
  "layout", "nagar", "colony", "children", "childrens", "play", "ground", "grounds",
  "complex", "city", "town", "village", "club", "resort", "theatre", "theater",
]);
const distinctive = (name: string) => {
  const out = new Set<string>();
  for (const t of tokens(name)) if (!GENERIC.has(t)) out.add(t);
  return out;
};
const QUALIFIERS = new Set([
  "east", "west", "north", "south", "new", "old", "main", "upper", "lower",
  "first", "second", "phase", "branch", "extension", "ii", "iii",
]);
const stripParens = (s: string) => s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// A name shared by more than this many rows is a brand or a generic, not an
// identity — no distance makes those two rows the same place.
const MAX_NAME_FREQUENCY = 3;
// Two records of one place disagree by a few hundred metres, not kilometres.
const MAX_KM = 2;
// A real duplicate is a pair, occasionally a triple. Anything larger is a chain.
const MAX_CLUSTER = 3;

let TOKEN_FREQ = new Map<string, number>();
const rarity = (shared: Set<string>) =>
  shared.size === 0 ? Number.MAX_SAFE_INTEGER : Math.min(...[...shared].map((t) => TOKEN_FREQ.get(t) ?? 1));

function samePlace(a: Row, b: Row): { same: boolean; why: string } {
  const d = km(a, b);
  if (d > MAX_KM) return { same: false, why: "" };

  const na = stripParens(a.name);
  const nb = stripParens(b.name);
  const da = distinctive(na);
  const dbb = distinctive(nb);
  const shared = new Set([...da].filter((t) => dbb.has(t)));
  const freq = rarity(shared);
  if (freq > MAX_NAME_FREQUENCY) return { same: false, why: "" };

  const near = `${d.toFixed(2)} km apart, name shared by ${freq} row(s)`;
  if (norm(na) === norm(nb)) return { same: true, why: `identical name, ${near}` };
  if (squash(na) === squash(nb)) return { same: true, why: `same name, different spacing, ${near}` };

  const ta = tokens(na);
  const tb = tokens(nb);
  const smaller = ta.size <= tb.size ? ta : tb;
  const larger = ta.size <= tb.size ? tb : ta;
  const extra = [...larger].filter((t) => !smaller.has(t));
  if (extra.some((t) => QUALIFIERS.has(t))) return { same: false, why: "" };
  if (shared.size === 0) return { same: false, why: "" };

  const sub = [...da].every((t) => dbb.has(t)) || [...dbb].every((t) => da.has(t));
  if (sub) return { same: true, why: `one name contains the other (extra: ${extra.join(" ") || "none"}), ${near}` };
  return { same: false, why: "" };
}

async function run() {
  const { db } = await import("../../src/lib/db");
  const { sql } = await import("drizzle-orm");

  // City-only rows. Anything that is also a destination or a day trip was
  // already handled by the cross-table merge.
  const res = await db.execute(sql`
    SELECT id, name, slug, latitude, longitude, area
    FROM places WHERE kinds = 'city'
      AND latitude IS NOT NULL AND longitude IS NOT NULL`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = ((res as any).rows ?? res) as Record<string, unknown>[];
  const all: Row[] = raw
    .map((r) => ({
      id: String(r.id), name: String(r.name), slug: String(r.slug),
      lat: Number(r.latitude), lng: Number(r.longitude),
      area: r.area == null ? null : String(r.area),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  TOKEN_FREQ = new Map();
  for (const r of all) {
    for (const t of distinctive(stripParens(r.name))) TOKEN_FREQ.set(t, (TOKEN_FREQ.get(t) ?? 0) + 1);
  }

  // Union-find over pairs within neighbouring ~5 km cells.
  const parent = new Map<string, string>();
  const why = new Map<string, string>();
  for (const r of all) parent.set(r.id, r.id);
  const find = (x: string): string => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; }
    return x;
  };
  const CELL = 0.05;
  const bucket = new Map<string, Row[]>();
  const cx = (r: Row) => Math.round(r.lat / CELL);
  const cy = (r: Row) => Math.round(r.lng / CELL);
  for (const r of all) {
    const k = `${cx(r)}:${cy(r)}`;
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k)!.push(r);
  }
  for (const r of all) {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const o of bucket.get(`${cx(r) + i}:${cy(r) + j}`) ?? []) {
        if (o.id <= r.id) continue;
        const m = samePlace(r, o);
        if (!m.same) continue;
        why.set(`${r.id}|${o.id}`, m.why);
        const a = find(r.id), b = find(o.id);
        if (a !== b) parent.set(a, b);
      }
    }
  }

  const byId = new Map(all.map((r) => [r.id, r]));
  const clusters = new Map<string, Row[]>();
  for (const r of all) {
    const root = find(r.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(r);
  }

  const dupes: Row[][] = [];
  const tooBig: Row[][] = [];
  for (const c of clusters.values()) {
    if (c.length < 2) continue;
    if (c.length > MAX_CLUSTER) { tooBig.push(c); continue; }
    // Clique: every member must match every other directly.
    let clique = true;
    for (let i = 0; i < c.length && clique; i++)
      for (let j = i + 1; j < c.length; j++)
        if (!samePlace(c[i], c[j]).same) { clique = false; break; }
    if (clique) dupes.push(c);
    else tooBig.push(c);
  }
  dupes.sort((a, b) => a[0].name.localeCompare(b[0].name));

  // Confidence tracks distance and how the names matched, so the report is
  // tiered rather than flat. A pair with the SAME name a few metres apart is
  // one place recorded twice. A pair matched only because one name contains
  // the other, a kilometre and a half apart, is how you end up merging "Prince
  // of Peace Disciples Church" into "Peace Restaurant".
  const gapOf = (c: Row[]) => Math.max(...c.flatMap((x) => c.map((y) => km(x, y))));
  const sameName = (c: Row[]) =>
    c.every((x) => squash(stripParens(x.name)) === squash(stripParens(c[0].name)));
  const safe = dupes.filter((c) => sameName(c) && gapOf(c) <= 0.5);
  const review = dupes.filter((c) => !(sameName(c) && gapOf(c) <= 0.5));

  const table = (list: Row[][], startIndex: number) =>
    list.map((c, i) => {
      const [keep, ...rest] = c;
      const reason = c.flatMap((x) => c.map((y) => why.get(`${x.id}|${y.id}`))).find(Boolean) ?? "";
      return (
        `| ${startIndex + i + 1} | **${keep.name}** \`${keep.slug}\`${keep.area ? ` (${keep.area})` : ""} | ` +
        `${rest.map((r) => `${r.name} \`${r.slug}\``).join("<br>")} | ` +
        `${gapOf(c).toFixed(2)} km | ${reason} |`
      );
    });

  const md: string[] = [];
  md.push("# Duplicates inside the city catalogue — REVIEW (nothing written)\n");
  md.push(`- city-only rows scanned: **${all.length}**`);
  md.push(`- clusters found: **${dupes.length}** (${dupes.reduce((a, c) => a + c.length - 1, 0)} rows removable)`);
  md.push(`  - **${safe.length}** high confidence (same name, within 500 m)`);
  md.push(`  - **${review.length}** need a human eye`);
  md.push(`- rejected as chains/generics: **${tooBig.length}**\n`);
  md.push(
    "Gate: a shared name carried by more than 3 rows in the whole catalogue is a brand " +
    "or a generic, never an identity — that is what keeps the 77 Domino's and 20 " +
    "\"Shiva Temple\" out. Plus <=2 km apart, clusters of at most 3, and every member " +
    "matching every other directly.\n"
  );
  md.push("## High confidence — same name, within 500 m\n");
  md.push("| # | keep | duplicate of | apart | why |");
  md.push("|---|---|---|---|---|");
  md.push(...table(safe, 0));
  md.push("\n## Needs review — matched on a partial name, or further apart\n");
  md.push(
    "Read every row here. The rule is right more often than not, but it is also " +
    "what pairs \"Go Naturals Fresh Cane Juice\" with \"Cafe Naturals\".\n"
  );
  md.push("| # | keep | candidate duplicate | apart | why |");
  md.push("|---|---|---|---|---|");
  md.push(...table(review, safe.length));
  mkdirSync("scripts/merge", { recursive: true });
  writeFileSync("scripts/merge/city-dupes.md", md.join("\n") + "\n");
  writeFileSync(
    "scripts/merge/city-dupes.json",
    JSON.stringify({ safe: safe.map((c) => ({ keep: c[0], remove: c.slice(1) })), review: review.map((c) => ({ keep: c[0], remove: c.slice(1) })) }, null, 2)
  );

  console.log(`city-only rows: ${all.length}`);
  console.log(`clusters: ${dupes.length} (${safe.length} high confidence, ${review.length} need review)`);
  console.log(`rejected as chains/generics/too-large: ${tooBig.length}`);
  console.log("\nsample:");
  for (const c of dupes.slice(0, 15)) {
    console.log(`  "${c[0].name}" x${c.length}  (${Math.max(...c.flatMap((x) => c.map((y) => km(x, y)))).toFixed(2)} km)`);
  }
  console.log("\nwrote scripts/merge/city-dupes.md and city-dupes.json");
  void byId;
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
