// One canonical way to compare Indian district names, used everywhere a
// district chosen in the UI has to be matched against a district stored on a
// place.
//
// BUG-09 had two distinct halves, and this module fixes both:
//
//  1. Places went MISSING. The district dropdowns are built from the curated
//     INDIA_DISTRICTS list ("Bagalkot", "Chikkaballapur", "Chamarajanagar")
//     while the catalogue rows were seeded with the other common spelling
//     ("Bagalkote", "Chikkaballapura", "Chamarajanagara"). An exact SQL string
//     match therefore returned ZERO places for those districts even though the
//     places existed.
//
//  2. Places landed in the WRONG district. The old normaliser stripped the
//     words "rural" and "urban", so "Bengaluru Rural" and "Bengaluru Urban"
//     both collapsed to "bengaluru" — two genuinely different districts merged
//     into one. It also matched on prefixes in both directions, which let any
//     district whose name merely starts with another's be treated as the same
//     place.
//
// The rule here is strict equality AFTER canonicalisation, never a prefix test.

// Spelling pairs that are the same real district. Post-2014 Karnataka renames
// plus the anglicised forms still common in travel data. Keys and values are
// both canonicalised before use, so case/spacing here does not matter.
const DISTRICT_ALIASES: Record<string, string> = {
  bangalore: "bengaluru",
  bangalorerural: "bengalururural",
  bangaloreurban: "bengaluruurban",
  bellary: "ballari",
  belgaum: "belagavi",
  bijapur: "vijayapura",
  chikmagalur: "chikkamagaluru",
  chickmagalur: "chikkamagaluru",
  gulbarga: "kalaburagi",
  hospet: "vijayanagara",
  mangalore: "dakshinakannada",
  mysore: "mysuru",
  shimoga: "shivamogga",
  tumkur: "tumakuru",
  northkanara: "uttarakannada",
  southkanara: "dakshinakannada",
};

// Suffix noise that carries no meaning. Deliberately does NOT include "rural"
// or "urban" — those distinguish two real districts from each other.
const NOISE_WORDS = /\b(district|dist|zilla|zilha|taluk[au]?|taluq|tehsil|tahsil)\b/g;

// Lowercase, drop noise words, drop everything that isn't a letter or digit.
function canonical(name: string): string {
  return name.toLowerCase().replace(NOISE_WORDS, "").replace(/[^a-z0-9]/g, "");
}

// Indian place names are routinely written with or without a trailing "a"/"e"
// (Bagalkot/Bagalkote, Chikkaballapur/Chikkaballapura,
// Chamarajanagar/Chamarajanagara). Folding one trailing vowel makes those pairs
// compare equal without loosening the match into a prefix test — "Bidar" and
// "Bidarhalli" still differ, and "Bengaluru Rural" still differs from
// "Bengaluru Urban".
function foldTrailingVowel(s: string): string {
  return s.length > 4 ? s.replace(/[ae]$/, "") : s;
}

// The comparison key for a district name. Two names refer to the same district
// exactly when their keys are equal.
export function districtKey(name: string | null | undefined): string {
  if (!name) return "";
  const c = canonical(name);
  if (!c) return "";
  const aliased = DISTRICT_ALIASES[c] ?? c;
  return foldTrailingVowel(aliased);
}

export function districtMatches(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const ka = districtKey(a);
  const kb = districtKey(b);
  return ka !== "" && ka === kb;
}

// True when `district` is one of `wanted`. An empty `wanted` means "no district
// filter", so everything passes; a non-empty `wanted` with a null district on
// the place means the place cannot be placed in a district and is excluded.
export function districtInList(
  district: string | null | undefined,
  wanted: string[]
): boolean {
  if (wanted.length === 0) return true;
  if (!district) return false;
  const key = districtKey(district);
  if (!key) return false;
  return wanted.some((w) => districtKey(w) === key);
}
