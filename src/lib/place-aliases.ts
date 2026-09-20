// Alternative names a traveller may type for the same Indian place.
//
// Searching "Mysore" used to miss Chamundi Hills, Brindavan Gardens, St
// Philomena's Church, Karanji Lake and Jaganmohan Palace — every one of them in
// Mysuru — because the catalogue spells the district "Mysuru" and the query was
// a literal `%mysore%`. Both spellings are in daily use and neither is wrong,
// so a search for either has to find both.
//
// Pairs, not a one-way rename: someone typing the new name must also find rows
// still carrying the old one, which the catalogue is full of.
const ALIAS_PAIRS: [string, string][] = [
  ["bangalore", "bengaluru"],
  ["mysore", "mysuru"],
  ["mangalore", "mangaluru"],
  ["belgaum", "belagavi"],
  ["bellary", "ballari"],
  ["bijapur", "vijayapura"],
  ["gulbarga", "kalaburagi"],
  ["shimoga", "shivamogga"],
  ["tumkur", "tumakuru"],
  ["hubli", "hubballi"],
  ["chikmagalur", "chikkamagaluru"],
  ["hospet", "hosapete"],
  ["bagalkot", "bagalkote"],
  ["gadag", "gadaga"],
  // Beyond Karnataka — the same rename pattern, and the catalogue is national.
  ["calcutta", "kolkata"],
  ["bombay", "mumbai"],
  ["madras", "chennai"],
  ["poona", "pune"],
  ["baroda", "vadodara"],
  ["trivandrum", "thiruvananthapuram"],
  ["cochin", "kochi"],
  ["calicut", "kozhikode"],
  ["pondicherry", "puducherry"],
  ["allahabad", "prayagraj"],
  ["orissa", "odisha"],
  ["gurgaon", "gurugram"],
  ["simla", "shimla"],
  ["benares", "varanasi"],
  ["banaras", "varanasi"],
  ["ooty", "udhagamandalam"],
  ["panjim", "panaji"],
  ["vizag", "visakhapatnam"],
  ["waltair", "visakhapatnam"],
  ["tanjore", "thanjavur"],
  ["trichy", "tiruchirappalli"],
  ["madurai", "madura"],
  ["cuttack", "kataka"],
  ["ahmedabad", "amdavad"],
  ["indore", "indur"],
];

const EXPAND = new Map<string, Set<string>>();
for (const [a, b] of ALIAS_PAIRS) {
  if (!EXPAND.has(a)) EXPAND.set(a, new Set());
  if (!EXPAND.has(b)) EXPAND.set(b, new Set());
  EXPAND.get(a)!.add(b);
  EXPAND.get(b)!.add(a);
}

// Every spelling worth searching for, given what the traveller typed. Always
// includes the original. Matching is per WORD, so "mysore palace" expands to
// "mysuru palace" too rather than only whole-string aliases.
export function searchVariants(query: string): string[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [];
  const out = new Set<string>([q]);

  // Whole-phrase alias ("mysore" -> "mysuru").
  for (const alt of EXPAND.get(q) ?? []) out.add(alt);

  // Per-word alias, so a multi-word query still benefits.
  const words = q.split(" ");
  words.forEach((w, i) => {
    for (const alt of EXPAND.get(w) ?? []) {
      const swapped = [...words];
      swapped[i] = alt;
      out.add(swapped.join(" "));
    }
  });

  return [...out];
}
