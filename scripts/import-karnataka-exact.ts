/**
 * Import the "Karnataka: Exact Unique Tourist Places" list — 1117 names.
 *
 * Nothing already in the catalogue is inserted again. Matching uses the shared
 * name rule in scripts/lib/place-match.ts, which folds the 2014 city renames.
 *
 * WHAT THIS LIST NEEDS THAT THE DISTRICT LIST DID NOT
 * ---------------------------------------------------
 * 1. NO DISTRICTS. Every entry is a bare name, so a match cannot be confirmed
 *    against a district the way the previous import did. Containment matching
 *    is therefore dropped here — statewide, "Banashankari Temple" would
 *    swallow "Banashankari Temple Amargol", which is a different temple 400 km
 *    away. Only exact (alias-folded) name equality counts as a match.
 *    Districts are filled in afterwards by scripts/geocode-missing.ts, from
 *    Nominatim's own answer rather than a guess.
 *
 * 2. FRAGMENTS. The source says it removed "generated viewpoint, entrance,
 *    walking trail, circuit, landscape and similar filler entries". It did
 *    not. It still contains "Gol Gumbaz whispering gallery" and "Gol Gumbaz
 *    dome" beside "Gol Gumbaz"; "Queen's Bath gardens" beside "Queen's Bath";
 *    "Mysuru Palace Durbar Hall", "Kalyana Mantapa", "Amba Vilas" and
 *    "Diwan-e-Khas" beside "Mysuru Palace"; and, as two separate rows,
 *    "Hemakuta Hill sunrise" and "Hemakuta Hill sunset".
 *
 *    These are parts of a place, not places. Stored as rows they would each
 *    get their own page and their own search result, so searching "Hemakuta"
 *    would return three entries for one hill. They are excluded by default and
 *    listed in full, so the decision is visible rather than silent. Pass
 *    --include-fragments to add them anyway.
 *
 *    The test is deliberately conservative: a trailing descriptor is not
 *    enough on its own, the remainder must ALSO be a place we know. That keeps
 *    "Lalbagh Glass House", "Kali Tiger Reserve" and "Bannerghatta Butterfly
 *    Park", which a plain suffix filter would have thrown away.
 *
 *   npx tsx scripts/import-karnataka-exact.ts                     # dry run
 *   npx tsx scripts/import-karnataka-exact.ts --write
 *   npx tsx scripts/import-karnataka-exact.ts --write --include-fragments
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { KARNATAKA_EXACT } from "./data/karnataka-places-exact";
import { nameKey, slugify, isFragment } from "./lib/place-match";

const WRITE = process.argv.includes("--write");
const INCLUDE_FRAGMENTS = process.argv.includes("--include-fragments");

const STATE = "Karnataka";

// Section heading → category, where the heading is decisive. Anything else
// falls through to the name-based guess below.
const SECTION_CATEGORY: Record<string, string> = {
  "Coast & Temples": "beach",
  "Additional Coast": "beach",
  "Coastal & Culture": "beach",
  "Additional Coastal & Heritage": "beach",
  "Coast, Forest & Waterfalls": "beach",
  "Wildlife & Hills": "wildlife",
  "Additional Wildlife & Sacred Hills": "wildlife",
  "Hills & Waterfalls": "hill_station",
  "Hills & Heritage": "hill_station",
  "Hills & Spiritual": "hill_station",
  "Additional Hills": "hill_station",
};

function categoryOf(name: string, section: string): string {
  const n = name.toLowerCase();
  // The name wins over the section when it is unambiguous — "Bandipur
  // National Park" is wildlife even under a "Hills" heading.
  if (/\bnational park|wildlife|sanctuary|tiger reserve|\bzoo\b|safari|elephant camp|bird sanctuary|blackbuck|peacock sanctuary|sloth bear|biological park|butterfly\b/.test(n))
    return "wildlife";
  if (/\bfalls|waterfall\b/.test(n)) return "adventure";
  if (/\bbeach|island|lighthouse|backwater|estuary|harbour\b/.test(n)) return "beach";
  if (/\btemple|matha|mutt|masjid|mosque|dargah|basti|basadi|church|cathedral|chapel|basilica|sahib|gumbaz|rauza|tombs|necropolis|jinalaya|shrine|peetha|vihara|mantapa\b/.test(n))
    return "pilgrimage";
  // A NUMBERED cave is a rock-cut monument, not a hillside — "Badami Cave 1"
  // through "Cave 4" are the carved temples, and calling them a hill station
  // is simply wrong.
  if (/\bcave\s*\d/.test(n)) return "heritage";
  if (/\bhills?\b|\bbetta\b|\bgiri\b|\bpeak\b|\bghat\b|\bdurga\b|\bcaves?\b|\brocks?\b|\bgudda\b/.test(n))
    return "hill_station";
  if (/\blake|dam|reservoir|tank|river|sarovara|kere|pushkarini|bawdi|stepwell|forest|falls\b/.test(n))
    return "adventure";
  // A building is a building wherever the source filed it — this stops the
  // Manipal Museum of Anatomy being classed as a beach by its section.
  if (/\bmuseum|gallery|mansion|palace|fort|library|planetarium|aquarium|observatory\b/.test(n))
    return "heritage";
  // The section heading is the LAST resort, not an override.
  //
  // It used to be consulted before these name checks, and the source's
  // headings are far broader than they look: "Coast, Forest & Waterfalls"
  // covers inland Dandeli and Yana, so Supa Dam, Anshi forest and the Manipal
  // Museum of Anatomy were all being filed as beaches.
  if (SECTION_CATEGORY[section]) return SECTION_CATEGORY[section];
  return "heritage";
}

async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const { places } = await import("../src/lib/db/schema");

  // 1. Everything already in the catalogue statewide, keyed by folded name.
  const existingRes = await db.execute(sql`
    SELECT slug, name, district FROM places
    WHERE lower(coalesce(state, '')) IN ('karnataka', 'karnatka')
  `);
  const existingRows = (existingRes.rows ?? existingRes) as Array<{
    slug: string;
    name: string;
    district: string | null;
  }>;
  const existingByKey = new Map<string, { name: string; district: string | null }>();
  for (const r of existingRows) existingByKey.set(nameKey(r.name), r);

  const allSlugsRes = await db.execute(sql`SELECT slug FROM places`);
  const allSlugs = new Set(
    ((allSlugsRes.rows ?? allSlugsRes) as Array<{ slug: string }>).map((r) => r.slug)
  );

  console.log(`catalogue rows in ${STATE}: ${existingRows.length}`);

  // 2. Flatten, dropping repeats within the list itself.
  const wanted: Array<{ name: string; section: string }> = [];
  const seen = new Set<string>();
  let listDupes = 0;
  for (const s of KARNATAKA_EXACT) {
    for (const name of s.places) {
      const k = nameKey(name);
      if (seen.has(k)) {
        listDupes += 1;
        continue;
      }
      seen.add(k);
      wanted.push({ name, section: s.section });
    }
  }

  // A name is "known" if this list or the catalogue holds it — that is what a
  // fragment has to resolve to.
  const isKnown = (candidate: string) => {
    const k = nameKey(candidate);
    return seen.has(k) || existingByKey.has(k);
  };

  const already: Array<{ name: string; matched: string }> = [];
  const fragments: Array<{ name: string; parent: string }> = [];
  const fresh: Array<{ name: string; section: string }> = [];

  for (const w of wanted) {
    const hit = existingByKey.get(nameKey(w.name));
    if (hit) {
      already.push({ name: w.name, matched: hit.name });
      continue;
    }
    const parent = isFragment(w.name, isKnown);
    if (parent) {
      fragments.push({ name: w.name, parent });
      continue;
    }
    fresh.push(w);
  }

  console.log(`\nlist entries        : ${wanted.length + listDupes} (${listDupes} repeated in the list, collapsed)`);
  console.log(`  already present   : ${already.length}`);
  console.log(`  part of another   : ${fragments.length}  ${INCLUDE_FRAGMENTS ? "(INCLUDED by --include-fragments)" : "(excluded)"}`);
  console.log(`  new places        : ${fresh.length}`);

  if (fragments.length > 0) {
    console.log("\n── Parts of another place ──");
    for (const f of fragments) console.log(`  ${f.name}   ⊂  ${f.parent}`);
  }

  const toInsert = INCLUDE_FRAGMENTS ? [...fresh, ...fragments.map((f) => ({ name: f.name, section: "" }))] : fresh;

  if (!WRITE) {
    console.log("\n── New (would be inserted) ──");
    for (const f of fresh) console.log(`  ${f.name}  [${categoryOf(f.name, f.section)}]`);
    console.log(`\nDRY RUN — would insert ${toInsert.length}. Pass --write to do it.`);
    process.exit(0);
  }

  // 3. Insert. Coordinates and districts are left null here and filled in by
  //    scripts/geocode-missing.ts, which asks Nominatim and takes the district
  //    from its answer rather than guessing one.
  const rows = [];
  for (const w of toInsert) {
    let slug = slugify(w.name);
    if (allSlugs.has(slug)) slug = slugify(`${w.name}-karnataka`);
    if (allSlugs.has(slug)) continue;
    allSlugs.add(slug);

    rows.push({
      slug,
      name: w.name.slice(0, 220),
      kinds: "destination",
      category: categoryOf(w.name, w.section),
      description: `${w.name} is a tourist place in ${STATE}. Listed in the Karnataka tourism place inventory of heritage sites, temples, forts, beaches, waterfalls, wildlife areas and hills.`,
      shortDescription: `${w.name} — ${STATE}`.slice(0, 240),
      state: STATE,
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

  console.log(`Done. ${rows.length} added.`);
  console.log(`Next: npx tsx scripts/geocode-missing.ts --write   (fills coordinates + districts)`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
