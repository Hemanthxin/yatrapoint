/**
 * Import a district-wise reference list of tourist places into the catalogue.
 *
 * Generic over the state, so the same rules apply to every list rather than
 * each one growing its own script. Matching uses scripts/lib/place-match.ts.
 *
 *   npx tsx scripts/import-district-list.ts --state "Tamil Nadu"            # dry run
 *   npx tsx scripts/import-district-list.ts --state "Tamil Nadu" --write
 *   npx tsx scripts/import-district-list.ts --state "Tamil Nadu" --write --include-fragments
 *
 * MATCHING — how "already exists" is decided
 * ------------------------------------------
 *   1. Same alias-folded name in the same district → the same place. Skip.
 *   2. One name contains the other, same district → the same place written at
 *      a different length. Skip.
 *   3. Same name in a different district → skipped and printed. Across a
 *      state these are nearly always one place the two sources file
 *      differently (a reservoir on a district border, a town reassigned in a
 *      2019 district split) rather than two places sharing a name.
 *   4. A name that is a PART of another place ("X gardens" where X exists) is
 *      excluded, and listed, unless --include-fragments.
 *
 * Coordinates and any missing districts are filled in afterwards by
 * scripts/geocode-missing.ts.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import {
  nameKey,
  strongTokens,
  containmentMatch,
  districtMatches,
  slugify,
  isFragment,
} from "./lib/place-match";

const WRITE = process.argv.includes("--write");
const INCLUDE_FRAGMENTS = process.argv.includes("--include-fragments");
const STATE = (() => {
  const i = process.argv.indexOf("--state");
  return i > -1 ? process.argv[i + 1] : "";
})();

if (!STATE) {
  console.error('Missing --state. Example: --state "Tamil Nadu"');
  process.exit(1);
}

interface DistrictPlaces {
  district: string;
  places: string[];
}

// State → the dataset module that holds its list.
async function loadData(state: string): Promise<DistrictPlaces[]> {
  switch (state.toLowerCase()) {
    case "tamil nadu": {
      const m = await import("./data/tamil-nadu-places");
      return m.TAMIL_NADU_PLACES;
    }
    case "kerala": {
      const m = await import("./data/kerala-places");
      return m.KERALA_PLACES;
    }
    case "maharashtra": {
      const m = await import("./data/maharashtra-places");
      return m.MAHARASHTRA_PLACES;
    }
    case "andhra pradesh": {
      const m = await import("./data/andhra-pradesh-places");
      return m.ANDHRA_PRADESH_PLACES;
    }
    case "telangana": {
      const m = await import("./data/telangana-places");
      return m.TELANGANA_PLACES;
    }
    default:
      throw new Error(`No dataset registered for state "${state}"`);
  }
}

function categoryOf(name: string): string {
  const n = name.toLowerCase();
  if (/\bnational park|wildlife|sanctuary|tiger reserve|\bzoo\b|safari|elephant camp|bird sanctuary|biosphere|deer park|crocodile|snake park|butterfly\b/.test(n))
    return "wildlife";
  if (/\bfalls|waterfall\b/.test(n)) return "adventure";
  if (/\bbeach|island|lighthouse|backwater|estuary|harbour|harbor|seashore|coast\b/.test(n))
    return "beach";
  if (/\btemple|kovil|koil|matha|mutt|math\b|masjid|mosque|dargah|basti|basadi|church|cathedral|chapel|basilica|shrine|sahib|gumbaz|rauza|tombs|jinalaya|mandapam|peetha|vihara|samadhi\b/.test(n))
    return "pilgrimage";
  if (/\bcave\s*\d/.test(n)) return "heritage";
  if (/\bhills?\b|\bmalai\b|\bbetta\b|\bgiri\b|\bpeak\b|\bghat\b|\bcaves?\b|\brocks?\b|\bviewpoint|view point\b/.test(n))
    return "hill_station";
  if (/\blake|dam|reservoir|tank|river|kere|falls|eri\b|\bcanal|spring|theertham\b/.test(n))
    return "adventure";
  if (/\bmuseum|gallery|palace|fort|library|planetarium|aquarium|observatory|mansion\b/.test(n))
    return "heritage";
  return "heritage";
}

async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const { places } = await import("../src/lib/db/schema");

  const data = await loadData(STATE);

  // 1. What the catalogue already holds for this state.
  const existingRes = await db.execute(sql`
    SELECT slug, name, district FROM places
    WHERE lower(coalesce(state, '')) = ${STATE.toLowerCase()}
  `);
  const existing = ((existingRes.rows ?? existingRes) as Array<{
    slug: string;
    name: string;
    district: string | null;
  }>).map((r) => ({ ...r, key: nameKey(r.name), tokens: strongTokens(r.name) }));
  const existingKeys = new Set(existing.map((e) => e.key));

  const allSlugsRes = await db.execute(sql`SELECT slug FROM places`);
  const allSlugs = new Set(
    ((allSlugsRes.rows ?? allSlugsRes) as Array<{ slug: string }>).map((r) => r.slug)
  );

  console.log(`${STATE}: ${data.length} districts in the list, ${existing.length} rows already in the catalogue`);

  // 2. Flatten, collapsing anything the list repeats across districts.
  const wanted: Array<{ name: string; district: string }> = [];
  const seenInList = new Set<string>();
  let listDupes = 0;
  for (const d of data) {
    for (const name of d.places) {
      const k = nameKey(name);
      if (seenInList.has(k)) {
        listDupes += 1;
        continue;
      }
      seenInList.add(k);
      wanted.push({ name, district: d.district });
    }
  }

  const isKnown = (candidate: string) => {
    const k = nameKey(candidate);
    return seenInList.has(k) || existingKeys.has(k);
  };

  const already: Array<{ name: string; district: string; matched: string; why: string }> = [];
  const crossDistrict: Array<{ name: string; district: string; matched: string; at: string }> = [];
  const fragments: Array<{ name: string; parent: string }> = [];
  const fresh: Array<{ name: string; district: string }> = [];

  for (const w of wanted) {
    const key = nameKey(w.name);
    const tokens = strongTokens(w.name);

    const sameName = existing.filter((e) => e.key === key);
    const inDistrict = sameName.find((e) => districtMatches(w.district, e.district));
    if (inDistrict) {
      already.push({ ...w, matched: inDistrict.name, why: "exact name, same district" });
      continue;
    }

    const contained = existing.find(
      (e) =>
        districtMatches(w.district, e.district) &&
        containmentMatch(tokens, e.tokens)
    );
    if (contained) {
      already.push({ ...w, matched: contained.name, why: "name contained, same district" });
      continue;
    }

    if (sameName.length > 0) {
      crossDistrict.push({
        ...w,
        matched: sameName[0].name,
        at: sameName[0].district ?? "(no district)",
      });
      continue;
    }

    const parent = isFragment(w.name, isKnown);
    if (parent) {
      fragments.push({ name: w.name, parent });
      continue;
    }

    fresh.push(w);
  }

  console.log(`\nlist entries              : ${wanted.length + listDupes} (${listDupes} repeated in the list, collapsed)`);
  console.log(`  already in catalogue    : ${already.length}`);
  console.log(`  same name, other district: ${crossDistrict.length} (skipped)`);
  console.log(`  part of another place   : ${fragments.length} ${INCLUDE_FRAGMENTS ? "(INCLUDED)" : "(excluded)"}`);
  console.log(`  new                     : ${fresh.length}`);

  // A single catalogue row absorbing several list entries is the signature of
  // over-matching, so it is reported rather than left to happen quietly.
  const byRow = new Map<string, string[]>();
  for (const a of already) byRow.set(a.matched, [...(byRow.get(a.matched) ?? []), a.name]);
  const greedy = [...byRow.entries()].filter(([, names]) => names.length > 1);
  if (greedy.length > 0) {
    console.log("\n── existing rows absorbing 2+ list entries ──");
    for (const [row, names] of greedy) console.log(`  ${row}  <-  ${names.join(" | ")}`);
  }

  if (crossDistrict.length > 0) {
    console.log("\n── Same name in another district (skipped as the same place) ──");
    for (const c of crossDistrict) console.log(`  ${c.district.padEnd(18)} ${c.name}  =  ${c.matched} in ${c.at}`);
  }
  if (fragments.length > 0) {
    console.log("\n── Parts of another place ──");
    for (const f of fragments) console.log(`  ${f.name}   ⊂  ${f.parent}`);
  }

  const toInsert = INCLUDE_FRAGMENTS
    ? [...fresh, ...fragments.map((f) => ({ name: f.name, district: "" }))]
    : fresh;

  if (!WRITE) {
    console.log(`\nDRY RUN — would insert ${toInsert.length} places. Pass --write to do it.`);
    process.exit(0);
  }

  const rows = [];
  for (const w of toInsert) {
    let slug = slugify(w.name);
    if (allSlugs.has(slug)) slug = slugify(`${w.name}-${w.district || STATE}`);
    if (allSlugs.has(slug)) continue;
    allSlugs.add(slug);

    rows.push({
      slug,
      name: w.name.slice(0, 220),
      kinds: "destination",
      category: categoryOf(w.name),
      description: `${w.name} is a tourist place in ${w.district ? `${w.district} district, ` : ""}${STATE}. Listed in the district-wise tourism inventory of heritage sites, temples, natural places, wildlife areas, beaches and museums.`,
      shortDescription: `${w.name} — ${[w.district, STATE].filter(Boolean).join(", ")}`.slice(0, 240),
      state: STATE,
      district: w.district || null,
      popularity: 40,
      budgetPerDay: 1500,
      recommendedDays: 1,
      entryFeePerPerson: 0,
    });
  }

  console.log(`\nInserting ${rows.length} places…`);
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(places).values(rows.slice(i, i + 100) as never).onConflictDoNothing();
  }

  console.log(`Done. ${rows.length} ${STATE} places added.`);
  console.log(`Next: npx tsx scripts/geocode-missing.ts --write --state "${STATE}"`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
