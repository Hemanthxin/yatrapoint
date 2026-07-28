const HASHTAG_RE = /#(\w+)/g;

export function extractHashtags(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(HASHTAG_RE)) out.add(m[1].toLowerCase());
  return [...out];
}

// Splits a caption into plain-text and hashtag segments so callers can
// render `#tag` runs as links without a regex in every component.
export function splitHashtags(text: string): { text: string; tag: string | null }[] {
  const parts: { text: string; tag: string | null }[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(HASHTAG_RE)) {
    const start = m.index ?? 0;
    if (start > lastIndex) parts.push({ text: text.slice(lastIndex, start), tag: null });
    parts.push({ text: m[0], tag: m[1].toLowerCase() });
    lastIndex = start + m[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), tag: null });
  return parts;
}
