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

export async function wikiImage(name: string): Promise<string | null> {
  const base = cleanTitle(name);
  if (!base) return null;
  // Plain title, then ", India" (resolves disambiguation like "Nandi Hills").
  for (const title of [base, `${base}, India`]) {
    const img = await summaryImage(title);
    if (img) return img;
  }
  return null;
}
