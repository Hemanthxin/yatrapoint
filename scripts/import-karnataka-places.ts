/**
 * Import the Karnataka Detailed Tourist Places list into the catalogue.
 *
 * 439 named places across all 31 districts, from the supplied reference PDF.
 * Nothing that is already in the catalogue is inserted again.
 *
 * MATCHING — how "already exists" is decided
 * ------------------------------------------
 * These entries arrive as a bare name and a district, with no coordinates, so
 * the usual distance-based de-dup rule in src/lib/place-dedup.ts cannot be
 * used. Matching is therefore done on the name, in three tiers:
 *
 *   1. Same normalised name in the same district  → the same place. Skip.
 *   2. One name contains the other, same district → the same place, written
 *      at a different length ("Belur" vs "Belur Chennakeshava Temple"). Skip,
 *      and say which row it matched.
 *   3. Same name in a DIFFERENT district → skipped, and printed so the call
 *      can be checked. Every case this list produces is one place the two
 *      sources file differently rather than two places sharing a name: two
 *      of them are dams sitting on a district border. Genuine homonyms —
 *      Karnataka has a Jama Masjid in Vijayapura and another inside Gulbarga
 *      Fort — are distinguished by their full names and never reach this tier.
 *
 * All three tiers compare names AFTER folding the 2014 city renames, because
 * the catalogue says "Mysore Palace" where the PDF says "Mysuru Palace".
 *
 * Places the PDF itself lists under two districts (Anegundi, Bhadra Wildlife
 * Sanctuary, Ranganathittu Bird Sanctuary) are collapsed to the first.
 *
 * COORDINATES come from Nominatim (OpenStreetMap), one request per second as
 * its usage policy requires. A place that cannot be geocoded is still
 * inserted — it is a real place and belongs in the catalogue — but without
 * coordinates it will not appear in distance-based features until someone
 * fills them in.
 *
 *   npx tsx scripts/import-karnataka-places.ts           # dry run
 *   npx tsx scripts/import-karnataka-places.ts --write   # geocode + insert
 *   npx tsx scripts/import-karnataka-places.ts --write --skip-geocode
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { KARNATAKA_PLACES } from "./data/karnataka-places";

const WRITE = process.argv.includes("--write");
const SKIP_GEOCODE = process.argv.includes("--skip-geocode");

const STATE = "Karnataka";

// Nominatim asks for at most one request per second and a real User-Agent.
const NOMINATIM_DELAY_MS = 1100;
const USER_AGENT = "Saafera/1.0 (+https://saafera.com; catalogue import)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Karnataka renamed most of its cities in 2014 and both spellings are in live
// use, so the catalogue and this PDF disagree constantly: "Mysore Palace" vs
// "Mysuru Palace", "Bangalore Palace" vs "Bengaluru Palace", "Mysore Zoo" vs
// "Mysuru Zoo". Without folding these together the import would have added a
// second copy of some of the best-known places in the state.
//
// `rail`/`railway` is here for the same reason at word level — the catalogue
// has "Rail Museum Mysore" where the PDF says "Railway Museum".
const ALIASES: Array<[RegExp, string]> = [
  [/\bbangalore\b/g, "bengaluru"],
  [/\bbanglore\b/g, "bengaluru"],
  [/\bmysore\b/g, "mysuru"],
  [/\bbelgaum\b/g, "belagavi"],
  [/\bbellary\b/g, "ballari"],
  [/\bgulbarga\b/g, "kalaburagi"],
  [/\bbijapur\b/g, "vijayapura"],
  [/\bshimoga\b/g, "shivamogga"],
  [/\btumkur\b/g, "tumakuru"],
  [/\bchikmagalur\b/g, "chikkamagaluru"],
  [/\bchickmagalur\b/g, "chikkamagaluru"],
  [/\bhospet\b/g, "hosapete"],
  [/\bmangalore\b/g, "mangaluru"],
  [/\bhubli\b/g, "hubballi"],
  [/\brailway\b/g, "rail"],
];

function canon(s: string): string {
  let out = s.toLowerCase();
  for (const [re, to] of ALIASES) out = out.replace(re, to);
  return out;
}

const nameKey = (s: string) => canon(s).replace(/[^a-z0-9]+/g, " ").trim();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);

// Words that carry no identity — "temple area", "region", "circuit" and the
// like describe the entry, not the place, so they must not be what makes two
// names look alike.
const WEAK = new Set([
  "area", "region", "circuit", "heritage", "temple", "fort", "the", "and",
  "near", "nearby", "landscape", "landscapes", "village", "villages", "town",
  "city", "point", "group", "complex", "site", "access", "from", "side",
  "approach", "via", "of", "sri", "shri",
]);

function strongTokens(name: string): Set<string> {
  return new Set(
    canon(name)
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !WEAK.has(t))
  );
}

function isSubsetOf(a: Set<string>, b: Set<string>): boolean {
  return a.size > 0 && [...a].every((t) => b.has(t));
}

// Districts are compared loosely: the catalogue holds "Bengaluru Urban",
// "Bangalore Urban" and "Bengaluru" for the same place.
function districtKey(s: string | null | undefined): string {
  return canon(s ?? "").replace(/[^a-z0-9]+/g, " ").trim();
}

function districtMatches(a: string, b: string | null | undefined): boolean {
  const ka = districtKey(a);
  const kb = districtKey(b);
  if (!kb) return true; // an existing row with no district can't contradict us
  if (ka === kb) return true;
  // "Bengaluru Urban" vs "Bengaluru"
  return ka.startsWith(kb) || kb.startsWith(ka);
}

// Category from the name. Deliberately conservative — anything unrecognised
// becomes heritage, which is what most of this list is.
function categoryOf(name: string): string {
  const n = name.toLowerCase();
  if (/\bbeach|island|lighthouse|backwater|port\b/.test(n)) return "beach";
  if (/\bnational park|wildlife|sanctuary|tiger reserve|zoo|safari|elephant camp|bird sanctuary|blackbuck|peacock|sloth bear|biological park\b/.test(n))
    return "wildlife";
  if (/\btemple|matha|math\b|masjid|dargah|basti|basadi|church|cathedral|chapel|sahib|gumbaz|rauza|tombs|betta temple|swamy|eshwara|shwara|jain\b/.test(n))
    return "pilgrimage";
  if (/\bfalls|waterfall\b/.test(n)) return "adventure";
  if (/\bhills?\b|\bbetta\b|\bgiri\b|\bpeak\b|\bghat\b|\bdurga\b(?! temple)|\bhill\b|\bpoint\b|\bcaves?\b|\brocks?\b/.test(n))
    return "hill_station";
  if (/\blake|dam|reservoir|tank|river|sarovara|kere|pushkarini\b/.test(n)) return "adventure";
  return "heritage";
}

interface GeoResult {
  lat: number;
  lng: number;
}

async function geocode(name: string, district: string): Promise<GeoResult | null> {
  const q = `${name}, ${district}, ${STATE}, India`;
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "in" }).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const lat = Number(rows[0].lat);
    const lng = Number(rows[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    // Karnataka's bounding box, roughly. A hit outside it means Nominatim
    // matched something else with the same name elsewhere in India.
    if (lat < 11.5 || lat > 19.0 || lng < 73.5 || lng > 79.0) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const { places } = await import("../src/lib/db/schema");

  // 1. Everything already in the catalogue, statewide.
  const existingRes = await db.execute(sql`
    SELECT slug, name, district, state, kinds
    FROM places
    WHERE lower(coalesce(state, '')) IN ('karnataka', 'karnatka')
  `);
  const existing = ((existingRes.rows ?? existingRes) as Array<{
    slug: string;
    name: string;
    district: string | null;
  }>).map((r) => ({ ...r, key: nameKey(r.name), tokens: strongTokens(r.name) }));

  const allSlugsRes = await db.execute(sql`SELECT slug FROM places`);
  const allSlugs = new Set(
    ((allSlugsRes.rows ?? allSlugsRes) as Array<{ slug: string }>).map((r) => r.slug)
  );

  console.log(`catalogue rows in ${STATE}: ${existing.length}`);

  // 2. Flatten the PDF list, collapsing the entries it repeats across
  //    districts (Anegundi, Bhadra Wildlife Sanctuary, Ranganathittu).
  const wanted: Array<{ name: string; district: string }> = [];
  const seenInPdf = new Set<string>();
  let pdfDupes = 0;
  for (const d of KARNATAKA_PLACES) {
    for (const name of d.places) {
      const k = nameKey(name);
      if (seenInPdf.has(k)) {
        pdfDupes += 1;
        continue;
      }
      seenInPdf.add(k);
      wanted.push({ name, district: d.district });
    }
  }

  // 3. Bucket each one.
  const skipped: Array<{ name: string; district: string; matched: string; why: string }> = [];
  const crossDistrict: Array<{ name: string; district: string; matched: string; at: string }> = [];
  const fresh: Array<{ name: string; district: string }> = [];

  for (const w of wanted) {
    const key = nameKey(w.name);
    const tokens = strongTokens(w.name);

    const sameName = existing.filter((e) => e.key === key);
    const inDistrict = sameName.find((e) => districtMatches(w.district, e.district));
    if (inDistrict) {
      skipped.push({ name: w.name, district: w.district, matched: inDistrict.name, why: "exact name, same district" });
      continue;
    }

    // Containment, but only within the district — "Belur" must not swallow
    // "Belur Chennakeshava Temple" from the other side of the state.
    const contained = existing.find(
      (e) =>
        districtMatches(w.district, e.district) &&
        (isSubsetOf(tokens, e.tokens) || isSubsetOf(e.tokens, tokens))
    );
    if (contained) {
      skipped.push({ name: w.name, district: w.district, matched: contained.name, why: "name contained, same district" });
      continue;
    }

    if (sameName.length > 0) {
      crossDistrict.push({
        name: w.name,
        district: w.district,
        matched: sameName[0].name,
        at: sameName[0].district ?? "(no district)",
      });
      continue;
    }

    fresh.push(w);
  }

  console.log(`\nPDF entries: ${wanted.length + pdfDupes} (${pdfDupes} listed under two districts, collapsed)`);
  console.log(`  already in catalogue : ${skipped.length}`);
  console.log(`  same name, other district: ${crossDistrict.length}  (skipped — same place, districts disagree)`);
  console.log(`  new                  : ${fresh.length}`);

  if (skipped.length > 0) {
    console.log("\n── Already present (not inserted) ──");
    for (const s of skipped.slice(0, 60)) {
      console.log(`  ${s.district.padEnd(18)} ${s.name}  ←  ${s.matched}  [${s.why}]`);
    }
    if (skipped.length > 60) console.log(`  … and ${skipped.length - 60} more`);
  }

  if (crossDistrict.length > 0) {
    console.log("\n── Same name in another district (skipped as the same place) ──");
    for (const c of crossDistrict) {
      console.log(`  ${c.district.padEnd(18)} ${c.name}  =  ${c.matched} in ${c.at}`);
    }
  }

  // Cross-district matches are NOT inserted.
  //
  // The rule "a different district means a different place" sounds right and
  // is wrong for every case this list actually produces. All four are one
  // place that the two sources file differently: Tungabhadra Dam and Almatti
  // Dam straddle district borders, Talakadu is in Mysuru district though the
  // PDF lists it under Mandya, and Kanva Reservoir is in Ramanagara though
  // the catalogue has it under Bengaluru Rural. Inserting them would create
  // precisely the duplicates this import exists to avoid.
  //
  // True homonyms — Karnataka has a Jama Masjid in Vijayapura and another
  // inside Gulbarga Fort, a Banashankari Temple at Badami and another at
  // Amargol — are distinguished by their names here, so they never reach this
  // branch. If a future list does produce one, it will be printed above and
  // can be added deliberately.
  const toInsert = [...fresh];

  if (!WRITE) {
    console.log("\n── New (would be inserted) ──");
    let lastD = "";
    for (const f of toInsert) {
      if (f.district !== lastD) {
        console.log(`  ${f.district}:`);
        lastD = f.district;
      }
      console.log(`      ${f.name}  [${categoryOf(f.name)}]`);
    }
    console.log(`\nDRY RUN — would insert ${toInsert.length} places. Pass --write to do it.`);
    process.exit(0);
  }

  // 4. Geocode and insert.
  const rows: Array<Record<string, unknown>> = [];
  let geocoded = 0;
  let n = 0;

  for (const w of toInsert) {
    n += 1;
    let coords: GeoResult | null = null;
    if (!SKIP_GEOCODE) {
      coords = await geocode(w.name, w.district);
      if (coords) geocoded += 1;
      await sleep(NOMINATIM_DELAY_MS);
    }

    let slug = slugify(w.name);
    if (allSlugs.has(slug)) slug = slugify(`${w.name}-${w.district}`);
    if (allSlugs.has(slug)) slug = slugify(`${w.name}-${w.district}-ka`);
    if (allSlugs.has(slug)) continue; // three collisions is not an accident
    allSlugs.add(slug);

    const category = categoryOf(w.name);
    rows.push({
      slug,
      name: w.name.slice(0, 220),
      kinds: "destination",
      category,
      description: `${w.name} is a tourist place in ${w.district} district, ${STATE}. Listed in the Karnataka Tourism district-wise guide to heritage sites, temples, forts, beaches, waterfalls, wildlife areas, hills and museums.`,
      shortDescription: `${w.name} — ${w.district}, ${STATE}`.slice(0, 240),
      state: STATE,
      district: w.district,
      latitude: coords ? String(coords.lat) : null,
      longitude: coords ? String(coords.lng) : null,
      popularity: 45,
      budgetPerDay: 1500,
      recommendedDays: 1,
      entryFeePerPerson: 0,
    });

    if (n % 25 === 0) {
      console.log(`  geocoded ${n}/${toInsert.length} (${geocoded} located)`);
    }
  }

  console.log(`\nInserting ${rows.length} places (${geocoded} with coordinates)…`);
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(places).values(rows.slice(i, i + 100) as never).onConflictDoNothing();
  }

  console.log(`Done. ${rows.length} Karnataka places added.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
