// Resolves a real photo for a place from its Wikipedia page (server-side,
// cached hard). Gives genuinely name-matched images for well-known places;
// callers fall back to a neutral photo when this returns null.

const cleanTitle = (name: string) =>
  name
    .replace(/\s*\(.*?\)\s*/g, " ") // drop "(Mysuru)" etc.
    .split(/[&,|]| - /)[0] // primary name before &/,/-
    .trim();

async function summaryImage(title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      {
        headers: { "User-Agent": "Saafera/1.0 (travel app)", Accept: "application/json" },
        signal: AbortSignal.timeout(4500),
        next: { revalidate: 604_800 }, // 1 week
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      type?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    };
    if (data.type === "disambiguation") return null;
    return data.thumbnail?.source ?? data.originalimage?.source ?? null;
  } catch {
    return null;
  }
}

// Full-text search (with the place's location) that returns the best-matching
// article's image — resolves generic/ambiguous names like "Nataraja Temple"
// or "Birla Mandir" to the right page.
async function searchImage(query: string): Promise<string | null> {
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrsearch: query,
        gsrlimit: "1",
        prop: "pageimages",
        piprop: "thumbnail",
        pithumbsize: "640",
        redirects: "1",
        origin: "*",
      }).toString();
    const res = await fetch(url, {
      headers: { "User-Agent": "Saafera/1.0 (travel app)", Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 604_800 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
    };
    const pages = data.query?.pages;
    if (!pages) return null;
    const first = Object.values(pages)[0];
    return first?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

export async function wikiImage(name: string, hint?: string): Promise<string | null> {
  const base = cleanTitle(name);
  if (!base) return null;
  // 1) Exact title (keeps already-correct places exactly as they are).
  const direct = await summaryImage(base);
  if (direct) return direct;
  // 2) Search using the name + location hint to nail ambiguous names.
  const query = [name, hint].filter(Boolean).join(" ").trim();
  return searchImage(query);
}
