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
//
// "temple" and "fort" are deliberately NOT here. They were, and it made
// containment matching catastrophic: "Vellore Fort" reduced to the single
// token {vellore}, which is a subset of every place in Vellore, so one
// catalogue row absorbed twenty-six distinct places — St John's Church, Oteri
// Lake, the Clock Tower, the Government Museum — and they were silently
// dropped from the import as "already present". The same happened to
// Kumbakonam (10 temples) and Kodaikanal (11 attractions). These words are
// part of a place's identity, not noise.
const WEAK = new Set([
  "area", "region", "circuit", "heritage", "the", "and",
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

/**
 * Do these two names describe one place written at different lengths?
 *
 * Bare subset testing is far too eager on real data. Two guards make it safe:
 *
 *   - The shorter name needs at least TWO identifying words. One is not an
 *     identity: {kumbakonam} is a subset of every temple in Kumbakonam.
 *   - They may differ by at most one word. "Vellore Fort" and "Government
 *     Museum Vellore Fort" are two words apart and are two different places;
 *     "Vellore Fort" and "Vellore fort moat" are one apart and are not.
 *
 * The cost is recall: "Bull Temple" no longer matches "Bull Temple (Dodda
 * Basavana Gudi)". That is the right way to be wrong here — an unmatched pair
 * shows up as a visible duplicate that can be merged, whereas an over-match
 * silently discards a real place and nobody ever finds out.
 */
export function containmentMatch(a: Set<string>, b: Set<string>): boolean {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  if (small.size < 2) return false;
  if (large.size - small.size > 1) return false;
  return isSubsetOf(small, large);
}

export function districtKey(s: string | null | undefined): string {
  // "The Nilgiris" and "Nilgiris" are one district.
  return canon(s ?? "").replace(/[^a-z0-9]+/g, " ").replace(/^the /, "").trim();
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
// Only words that name a PART. Several had to come out because they name
// somewhere people go in their own right, and the filter was throwing those
// places away:
//   beach, museum, park, lake, island, hill, cave, reserve, spring, harbour
//     — Kanyakumari Beach, Chettinad Museum, Vaigai Dam Park, Upper Bhavani Lake
//   backwaters, estuary
//     — in Kerala the backwaters ARE the destination. Kumarakom Backwaters,
//       Kuttanad Backwaters and Vaikom Backwaters are among the best-known
//       places in the state and were all being discarded as scenery.
// A museum beside a fort is a different visit from the fort.
const FRAGMENT_WORDS = new Set([
  "sunrise", "sunset", "view", "gardens", "garden", "courtyard", "steps",
  "promenade", "trail", "trails", "gallery", "interior", "enclosure",
  "pavilion", "complex", "ruins", "basement", "summit", "hilltop", "moat",
  "bastion", "gate", "birding", "safari", "pond", "theatre", "sky",
  "streets", "street", "walk", "houses", "boulders", "quarter",
  "township", "campus", "courtyards", "platform", "mandapas", "chamber",
  "remains", "wall", "walls", "shafts",
  "riverbank", "gorge", "entrance", "trailhead", "checkpoint", "zone",
  "ghats", "rooms", "viewpoints", "ramparts", "granaries",
  "road", "tank",
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
  if (words.length < 2) return null;

  // Some descriptors are part of a place-type name rather than a part of a
  // place. A botanical garden is somewhere you go; the gardens around Lotus
  // Mahal are not. Same for a rock garden or a rose garden.
  if (/\b(botanical|rose|rock|butterfly|deer|snake|theme|water)\s+(garden|gardens|park)\b/i.test(name))
    return null;
  // An art gallery is a museum you visit, not the gallery running around the
  // inside of a monument.
  if (/\bart\s+galler(y|ies)\b/i.test(name)) return null;

  // The LAST word decides whether this is a fragment at all. Everything before
  // it is just how far we have to walk back to find the parent.
  //
  // The check used to stop at the first word that was not itself a descriptor,
  // which missed anything with a real noun in the middle: "Kamalapura lake
  // sunset" and "Hampi museum courtyard" both walked one step, hit "lake" and
  // "museum", and gave up — so a sunset and a courtyard were about to become
  // places.
  const last = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, "");
  if (!FRAGMENT_WORDS.has(last)) return null;

  for (let strip = 1; strip <= 3 && strip < words.length; strip += 1) {
    const head = words.slice(0, words.length - strip).join(" ");
    if (head.length >= 3 && isKnown(head)) return head;
  }
  return null;
}
