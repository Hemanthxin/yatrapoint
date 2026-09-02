/**
 * Name matching for catalogue imports.
 *
 * Reference lists arrive as bare names — no coordinates — so the distance-based
 * de-dup rule in src/lib/place-dedup.ts cannot decide whether two entries are
 * the same place. These helpers do it on the name instead, and are shared by
 * every import script so they all agree on what "already exists" means.
 */

// Karnataka renamed most of its cities in 2014 and both spellings are in live
// use, so a reference list and the catalogue disagree constantly: "Mysore
// Palace" against "Mysuru Palace", "Bangalore Palace" against "Bengaluru
// Palace". Folding these is what stops an import adding a second copy of some
// of the best-known places in the state.
//
// `railway`→`rail` is the same problem at word level: the catalogue holds
// "Rail Museum Mysore" where a list says "Railway Museum".
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

export function canon(s: string): string {
  let out = (s ?? "").toLowerCase();
  for (const [re, to] of ALIASES) out = out.replace(re, to);
  return out;
}

export function nameKey(s: string): string {
  return canon(s).replace(/[^a-z0-9]+/g, " ").trim();
}

// Words that describe the ENTRY rather than identify the place, so they must
// not be what makes two names look alike.
const WEAK = new Set([
  "area", "region", "circuit", "heritage", "temple", "fort", "the", "and",
  "near", "nearby", "landscape", "landscapes", "village", "villages", "town",
  "city", "point", "group", "complex", "site", "access", "from", "side",
  "approach", "via", "of", "sri", "shri",
]);

export function strongTokens(name: string): Set<string> {
  return new Set(
    canon(name)
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !WEAK.has(t))
  );
}

export function isSubsetOf(a: Set<string>, b: Set<string>): boolean {
  return a.size > 0 && [...a].every((t) => b.has(t));
}

export function districtKey(s: string | null | undefined): string {
  return canon(s ?? "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function districtMatches(a: string, b: string | null | undefined): boolean {
  const ka = districtKey(a);
  const kb = districtKey(b);
  if (!kb) return true; // a row with no district can't contradict us
  if (ka === kb) return true;
  return ka.startsWith(kb) || kb.startsWith(ka); // "Bengaluru Urban" vs "Bengaluru"
}

export function slugify(s: string, max = 140): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

// Trailing words that name a PART of a place rather than a place: the
// whispering gallery inside Gol Gumbaz, the gardens around Queen's Bath, the
// sunrise seen from Hemakuta Hill.
//
// A word appearing here is not enough on its own — "Lalbagh Glass House" and
// "Bannerghatta Butterfly Park" must survive. A name only counts as a fragment
// when stripping the descriptor leaves something that is ITSELF a known place.
// See isFragment().
const FRAGMENT_WORDS = new Set([
  "sunrise", "sunset", "view", "gardens", "garden", "courtyard", "steps",
  "promenade", "trail", "trails", "gallery", "interior", "enclosure",
  "pavilion", "complex", "ruins", "basement", "summit", "hilltop", "moat",
  "bastion", "gate", "birding", "safari", "tank", "pond", "theatre", "sky",
  "streets", "street", "road", "walk", "houses", "boulders", "quarter",
  "township", "campus", "courtyards", "platform", "mandapas", "chamber",
  "remains", "wall", "walls", "shafts", "reserve", "backwaters", "estuary",
  "riverbank", "gorge", "cave", "caves", "hill", "lake", "beach", "island",
  "islands", "spring", "entrance", "trailhead", "checkpoint", "zone",
  "harbour", "ghat", "ghats", "park", "museum", "rooms",
]);

/**
 * Is `name` a part of some other place rather than a place in its own right?
 *
 * Strips up to three trailing descriptor words; if what remains is a name the
 * caller already knows (`isKnown`), this is a fragment of it. Returns the
 * parent name so the caller can say what it belongs to.
 *
 * The two-part test is deliberate. A suffix list alone would throw away
 * "Lalbagh Glass House" and "Kali Tiger Reserve"; requiring the remainder to
 * resolve to a real place means "Gol Gumbaz whispering gallery" is caught
 * (Gol Gumbaz exists) while "Bannerghatta Butterfly Park" survives
 * ("Bannerghatta Butterfly" is not a place).
 */
export function isFragment(
  name: string,
  isKnown: (candidate: string) => boolean
): string | null {
  const words = name.trim().split(/\s+/);
  for (let strip = 1; strip <= 3 && strip < words.length; strip += 1) {
    const tail = words[words.length - strip].toLowerCase().replace(/[^a-z]/g, "");
    if (!FRAGMENT_WORDS.has(tail)) break;
    const head = words.slice(0, words.length - strip).join(" ");
    if (head.length >= 3 && isKnown(head)) return head;
  }
  return null;
}
