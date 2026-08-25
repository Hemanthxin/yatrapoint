import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { mkdirSync, writeFileSync } from "node:fs";

// Dry-run planner for consolidating destinations + nearby_destinations +
// city_places into one `places` table.
//
// Writes a reviewable plan to scripts/merge/merge-plan.json and a readable
// summary to scripts/merge/merge-plan.md. Writes NOTHING to the database.
//
// Matching here is deliberately STRICTER than the display-time rule in
// lib/place-dedup.ts. That rule can merge on proximity alone (~110 m), which is
// fine when the cost of being wrong is one duplicate card, but unacceptable
// when the cost is deleting a row: it clustered Bangalore Fort with a temple
// and a restaurant that merely sit near it. A merge here requires the NAMES to
// agree as well, never proximity on its own.

type Src = "destination" | "nearby" | "city";

interface Row {
  src: Src;
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
  gallery: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const HONORIFICS = new Set(["sri", "shri", "sree", "shree", "st", "saint", "the"]);
const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t))
    .join("");
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
const subset = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((t) => b.has(t));

// Words that make two similarly-named places DIFFERENT places.
const QUALIFIERS = new Set([
  "east", "west", "north", "south", "new", "old", "main",
  "upper", "lower", "first", "second", "phase", "branch", "extension",
]);

// Words that describe WHAT a place is, not WHICH place it is. "Anjaneya
// Temple" and "Sri Karya Siddhi Veera Anjaneya Swamy Temple" share only such
// words plus one deity name, and are two different shrines; treating those as
// identity is what let a single cluster swallow 69 unrelated rows. A name must
// carry at least two of its OWN words, after these are removed, before a
// containment match is allowed.
const GENERIC = new Set([
  "temple", "mandir", "devasthana", "devalaya", "shrine", "math", "matha", "mutt",
  "swamy", "swami", "sri", "shri", "sree", "shree", "st", "saint", "the", "and", "of",
  "park", "garden", "lake", "tank", "fort", "palace", "museum", "falls", "waterfall",
  "hills", "hill", "betta", "durga", "church", "cathedral", "mosque", "masjid",
  "restaurant", "hotel", "bar", "cafe", "coffee", "canteen", "store", "shop",
  "mall", "market", "centre", "center", "point", "view", "viewpoint",
  "road", "circle", "cross", "layout", "nagar", "colony", "children", "childrens",
  "play", "ground", "grounds", "complex", "city", "town", "village",
]);
const distinctive = (name: string) => {
  const out = new Set<string>();
  for (const t of tokens(name)) if (!GENERIC.has(t)) out.add(t);
  return out;
};

// Parenthetical text is an alias or clarifier, not a different place:
// "Shivanasamudra Falls (Gaganachukki & Bharachukki)" and "Channapatna (Toy
// Town)" are one place each. Stripping it before comparing names is what lets
// those match their plainer twin, while keeping "Sapphire Skydeck (Vidhana
// Soudha View Point)" — whose REAL name is the skydeck — from being mistaken
// for the Vidhana Soudha itself.
const stripParens = (s: string) => s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

// How far apart two rows may be and still be one place depends entirely on how
// distinctive the name is. Independently-entered rows for a uniquely-named spot
// disagree by many km ("Bheemeshwari" is 19 km apart across two catalogues and
// is unmistakably the same place), while a name shared by dozens of real places
// ("Shiva Temple") means nothing at all beyond a few hundred metres.
function toleranceKm(sharedNameFrequency: number): number {
  if (sharedNameFrequency <= 3) return 25; // effectively unique nationally
  if (sharedNameFrequency <= 8) return 5; // uncommon
  return 0.5; // common — only an exact co-location counts
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// How many rows in the whole dataset contain each distinctive token. Built once
// in run() and read here to judge how much a shared name is really worth.
let TOKEN_FREQ = new Map<string, number>();
const rarityOf = (shared: Set<string>): number => {
  if (shared.size === 0) return Number.MAX_SAFE_INTEGER;
  // The rarest shared word carries the identity: "Sri Kolaramma Temple" is
  // pinned by "kolaramma", not by "sri" or "temple".
  return Math.min(...[...shared].map((t) => TOKEN_FREQ.get(t) ?? 1));
};

// A merge is proposed only when the names genuinely agree AND the rows are
// closer than the tolerance that name's rarity earns. Distance is a guard on
// every rule, never a rule of its own.
function sameForMerge(a: Row, b: Row): { same: boolean; why: string; confidence: "high" | "review" } {
  const d = km(a, b);
  const nameA = stripParens(a.name);
  const nameB = stripParens(b.name);

  const da = distinctive(nameA);
  const dbb = distinctive(nameB);
  const shared = new Set([...da].filter((t) => dbb.has(t)));
  const freq = rarityOf(shared);
  const tol = toleranceKm(freq);
  const no = { same: false as const, why: "", confidence: "high" as const };

  if (d > tol) return no;
  const near = `${d.toFixed(2)} km apart, name shared by ${freq} row(s), tolerance ${tol} km`;

  if (norm(nameA) === norm(nameB)) return { same: true, why: `identical name, ${near}`, confidence: "high" };
  if (squash(nameA) === squash(nameB)) {
    return { same: true, why: `same name, different spacing/honorific, ${near}`, confidence: "high" };
  }

  const ta = tokens(nameA);
  const tb = tokens(nameB);
  const smaller = ta.size <= tb.size ? ta : tb;
  const larger = ta.size <= tb.size ? tb : ta;
  const extra = [...larger].filter((t) => !smaller.has(t));
  if (extra.some((t) => QUALIFIERS.has(t))) return no;

  // The shared part must actually identify a place. "Anjaneya Temple" inside
  // "Sri Veera Anjaneya Swamy Temple" is two shrines sharing a deity name, and
  // "anjaneya" appears in dozens of rows — so a common shared word is not
  // identity no matter how close the two rows sit.
  if (shared.size === 0 || freq > 8) return no;

  if (subset(da, dbb) || subset(dbb, da)) {
    // ALWAYS a human decision. One name containing another is the single
    // weakest signal here and it is wrong in both directions: "Kurudumale
    // Ganesha" inside "Kurudumale Ganesha Temple" is one place, but "Ulsoor"
    // inside "Watson's Ulsoor" is a lake and a pub, and "Cubbon Park" inside
    // "Mark Cubbon Statue" is a park and a statue. Nothing in the name itself
    // tells those apart, so containment is proposed but never auto-approved.
    const extraDistinct = extra.filter((t) => !GENERIC.has(t));
    return {
      same: true,
      why:
        `one name contains the other (extra: ${extra.join(" ") || "none"}), ${near}` +
        (extraDistinct.length ? ` — extra words are distinctive: ${extraDistinct.join(" ")}` : ""),
      confidence: "review",
    };
  }

  const sa = squash(nameA);
  const sb = squash(nameB);
  const shortS = sa.length <= sb.length ? sa : sb;
  const longS = sa.length <= sb.length ? sb : sa;
  if (shortS.length >= 10 && longS.includes(shortS)) {
    return { same: true, why: `name contained after squashing, ${near}`, confidence: "high" };
  }
  return no;
}

async function run() {
  const { db } = await import("../../src/lib/db");
  const { destinations, nearbyDestinations, cityPlaces, placeImages } = await import(
    "../../src/lib/db/schema"
  );

  const [dest, near, city, imgs] = await Promise.all([
    db.select().from(destinations),
    db.select().from(nearbyDestinations),
    db.select().from(cityPlaces),
    db.select().from(placeImages),
  ]);

  const gal = new Map<string, number>();
  for (const i of imgs) {
    const k = `${i.placeType}:${i.placeId}`;
    gal.set(k, (gal.get(k) ?? 0) + 1);
  }

  const mk =
    (src: Src) =>
    (r: {
      id: string; slug: string; name: string;
      latitude: string | null; longitude: string | null; imageUrl: string | null;
    }): Row | null => {
      const lat = Number(r.latitude);
      const lng = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        src, id: r.id, slug: r.slug, name: r.name, lat, lng,
        imageUrl: r.imageUrl ?? null,
        gallery: gal.get(`${src}:${r.id}`) ?? 0,
      };
    };

  const all = [
    ...dest.map(mk("destination")),
    ...near.map(mk("nearby")),
    ...city.map(mk("city")),
  ].filter((r): r is Row => r !== null);

  // How many rows contain each distinctive word. This is what separates a name
  // that identifies ONE place ("bheemeshwari": 2 rows) from one that labels
  // dozens ("anjaneya": 60+ rows), and it drives both the distance tolerance
  // and whether a shared word counts as identity at all.
  TOKEN_FREQ = new Map<string, number>();
  for (const r of all) {
    for (const t of distinctive(stripParens(r.name))) {
      TOKEN_FREQ.set(t, (TOKEN_FREQ.get(t) ?? 0) + 1);
    }
  }

  // Union-find over strict matches.
  const key = (r: Row) => `${r.src}:${r.id}`;
  const parent = new Map<string, string>();
  const why = new Map<string, string>();
  for (const r of all) parent.set(key(r), key(r));
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };

  // Compare only rows in neighbouring cells — the full 10k x 10k comparison is
  // unnecessary and slow. Cells are ~55 km so the widest tolerance (25 km for a
  // uniquely-named place) is always covered by the 3x3 neighbourhood.
  const CELL = 0.5; // degrees
  const cx = (r: Row) => Math.round(r.lat / CELL);
  const cy = (r: Row) => Math.round(r.lng / CELL);
  const bucket = new Map<string, Row[]>();
  for (const r of all) {
    const c = `${cx(r)}:${cy(r)}`;
    if (!bucket.has(c)) bucket.set(c, []);
    bucket.get(c)!.push(r);
  }

  for (const r of all) {
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        const nb = bucket.get(`${cx(r) + dLat}:${cy(r) + dLng}`) ?? [];
        for (const o of nb) {
          if (o === r || key(o) <= key(r)) continue;
          // CROSS-TABLE ONLY. Duplicates *within* city_places are a different
          // problem with a different answer: those 8,685 rows are bulk-seeded
          // from OSM and mostly contain genuinely distinct places that happen
          // to share a name (77 Domino's, 20 "Shiva Temple"). Merging inside
          // one table destroys real places; the duplication reported — the
          // same place appearing as both a Destination and a One-day trip —
          // is entirely cross-table.
          if (o.src === r.src) continue;
          const m = sameForMerge(r, o);
          if (!m.same) continue;
          why.set(`${key(r)}|${key(o)}`, m.why);
          const a = find(key(r));
          const b = find(key(o));
          if (a !== b) parent.set(a, b);
        }
      }
    }
  }

  const clusters = new Map<string, Row[]>();
  for (const r of all) {
    const root = find(key(r));
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(r);
  }

  // Reject any cluster that is not a CLIQUE — every member must match every
  // other member directly. Union-find alone is transitive: A~B and B~C put A
  // and C together even when A and C are unrelated, which is how one cluster
  // grew to 69 rows. Requiring a clique keeps only groups that are duplicates
  // by every pairing, and a chained cluster is dropped for manual review
  // rather than silently merged.
  const chained: Row[][] = [];
  const dupes: Row[][] = [];
  for (const c of clusters.values()) {
    if (c.length < 2) continue;
    let clique = true;
    for (let i = 0; i < c.length && clique; i++) {
      for (let j = i + 1; j < c.length; j++) {
        if (!sameForMerge(c[i], c[j]).same) {
          clique = false;
          break;
        }
      }
    }
    (clique ? dupes : chained).push(c);
  }
  dupes.sort((a, b) => a[0].name.localeCompare(b[0].name));

  // Survivor: the row whose id must be preserved. A destination id is
  // referenced by favorites + trip_plan_items, so it always wins; otherwise the
  // richer row wins (gallery first, then a stored image, then more data).
  const RANK: Record<Src, number> = { destination: 0, nearby: 1, city: 2 };
  const plan = dupes.map((c) => {
    const sorted = [...c].sort((a, b) => {
      if (RANK[a.src] !== RANK[b.src]) return RANK[a.src] - RANK[b.src];
      if (b.gallery !== a.gallery) return b.gallery - a.gallery;
      return (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0);
    });
    const survivor = sorted[0];
    const absorbed = sorted.slice(1);
    const pairWhy = c
      .flatMap((x) => c.map((y) => why.get(`${key(x)}|${key(y)}`)))
      .filter((v): v is string => !!v);
    return {
      survivor: {
        src: survivor.src, id: survivor.id, slug: survivor.slug,
        name: survivor.name, gallery: survivor.gallery, hasImage: !!survivor.imageUrl,
      },
      absorbed: absorbed.map((r) => ({
        src: r.src, id: r.id, slug: r.slug, name: r.name,
        gallery: r.gallery, hasImage: !!r.imageUrl,
      })),
      kinds: [...new Set(c.map((r) => r.src))].sort(),
      legacySlugs: absorbed.map((r) => r.slug),
      galleryMovedFrom: absorbed.filter((r) => r.gallery > 0).map((r) => `${r.src}:${r.id} (${r.gallery} photos)`),
      imageAdoptedFrom: !survivor.imageUrl ? absorbed.find((r) => r.imageUrl)?.src ?? null : null,
      maxGapKm: Number(Math.max(...c.flatMap((x) => c.map((y) => km(x, y)))).toFixed(2)),
      matchedBecause: [...new Set(pairWhy)],
      confidence: c.some((x) => c.some((y) => x !== y && sameForMerge(x, y).confidence === "review"))
        ? "review"
        : "high",
      // Only exact-name matches are pre-approved. Anything resting on one name
      // containing another starts EXCLUDED — flip it to true after checking
      // the two rows really are one place.
      approved: false, // set by confidence below
    };
  });

  // Exact-name clusters are safe to pre-approve; containment clusters are not.
  for (const c of plan) c.approved = c.confidence === "high";

  mkdirSync("scripts/merge", { recursive: true });
  writeFileSync("scripts/merge/merge-plan.json", JSON.stringify(plan, null, 2));
  writeFileSync(
    "scripts/merge/needs-review.json",
    JSON.stringify(
      chained.map((c) => c.map((r) => ({ src: r.src, id: r.id, name: r.name, slug: r.slug }))),
      null,
      2
    )
  );

  const absorbedTotal = plan.reduce((a, c) => a + c.absorbed.length, 0);
  const rowsAfter = all.length - absorbedTotal;

  const md: string[] = [];
  md.push("# Place merge plan — DRY RUN (nothing has been written)\n");
  md.push(`- rows today: **${all.length}** (destinations ${dest.length}, one-day trips ${near.length}, city places ${city.length})`);
  md.push(`- duplicate clusters found: **${plan.length}**`);
  md.push(`- rows absorbed into a survivor: **${absorbedTotal}**`);
  md.push(`- rows after merge: **${rowsAfter}**`);
  md.push(`- clusters where a gallery moves onto the survivor: **${plan.filter((p) => p.galleryMovedFrom.length).length}**`);
  md.push(`- clusters where the survivor gains a photo it lacked: **${plan.filter((p) => p.imageAdoptedFrom).length}**`);
  md.push("\nTo exclude a cluster, set `\"approved\": false` on it in `merge-plan.json`.\n");
  md.push("| # | survivor (kept id) | absorbs | becomes kinds | gallery moved | max gap | matched because |");
  md.push("|---|---|---|---|---|---|---|");
  plan.forEach((p, i) => {
    md.push(
      `| ${i + 1} | \`${p.survivor.src}\` **${p.survivor.name}** (gal ${p.survivor.gallery}) | ` +
        `${p.absorbed.map((a) => `\`${a.src}\` ${a.name} (gal ${a.gallery})`).join("<br>")} | ` +
        `${p.kinds.join(", ")} | ${p.galleryMovedFrom.join(", ") || "—"} | ${p.maxGapKm} km | ` +
        `${p.matchedBecause.join("; ") || "—"} |`
    );
  });
  writeFileSync("scripts/merge/merge-plan.md", md.join("\n") + "\n");

  console.log(`clusters:              ${plan.length}`);
  console.log(`rows ${all.length} -> ${rowsAfter} (absorbing ${absorbedTotal})`);
  console.log(`galleries relocated:   ${plan.filter((p) => p.galleryMovedFrom.length).length}`);
  console.log(`survivor gains image:  ${plan.filter((p) => p.imageAdoptedFrom).length}`);
  console.log(`chained clusters held back for manual review: ${chained.length}`);
  console.log("\nwrote scripts/merge/merge-plan.json, merge-plan.md, needs-review.json");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
