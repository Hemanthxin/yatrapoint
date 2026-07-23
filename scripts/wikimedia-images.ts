// Fills in imageUrl for every Karnataka place from Wikipedia's page image,
// restricted to files actually hosted on Wikimedia Commons (freely licensed,
// reusable anywhere) — local enwiki-only uploads are typically non-free
// fair-use images restricted to that one article, so those are skipped.
// Free, no API key, no future dependency beyond hotlinking a stable CDN URL
// (the same one Wikipedia itself uses to serve the image).
//
// Run: npx tsx scripts/wikimedia-images.ts [group-a|...|extra]
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const UA = "YatraPoint/1.0 (place image enrichment; admin@yatrapoint.local)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FILES: Record<string, { file: string; exportName: string }> = {
  "group-a": { file: "src/lib/db/karnataka/group-a.ts", exportName: "karnatakaBengaluruRegion" },
  "group-b": { file: "src/lib/db/karnataka/group-b.ts", exportName: "karnatakaMysuruRegion" },
  "group-c": { file: "src/lib/db/karnataka/group-c.ts", exportName: "karnatakaMalnadRegion" },
  "group-d": { file: "src/lib/db/karnataka/group-d.ts", exportName: "karnatakaCoastalRegion" },
  "group-e": { file: "src/lib/db/karnataka/group-e.ts", exportName: "karnatakaKalyanaRegion" },
  "group-f": { file: "src/lib/db/karnataka/group-f.ts", exportName: "karnatakaKitturRegion" },
  extra: { file: "src/lib/db/india/karnataka-extra.ts", exportName: "karnatakaExtraDestinations" },
};

type Place = {
  slug: string;
  name: string;
  district: string | null;
  imageUrl: string | null;
  latitude: string | null;
  longitude: string | null;
};

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Loose word-overlap check between the place name and the matched article
// title — catches the "matched a totally unrelated/broader article" case when
// there's no coordinate to check against.
const STOPWORDS = new Set(["the", "of", "and", "temple", "falls", "hill", "hills", "fort", "lake", "dam"]);
function nameOverlaps(placeName: string, title: string): boolean {
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/[(),]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const a = new Set(words(placeName));
  const b = new Set(words(title));
  for (const w of a) if (b.has(w)) return true;
  return false;
}

async function searchCandidate(query: string): Promise<{ title: string; coord: { lat: number; lng: number } | null } | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({ action: "query", list: "search", srsearch: query, format: "json", srlimit: "1" });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const data = (await res.json()) as any;
  const title = data?.query?.search?.[0]?.title;
  if (!title) return null;

  const coordUrl =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({ action: "query", prop: "coordinates", titles: title, format: "json" });
  const cres = await fetch(coordUrl, { headers: { "User-Agent": UA } });
  const cdata = (await cres.json()) as any;
  const page: any = Object.values(cdata?.query?.pages ?? {})[0];
  const c = page?.coordinates?.[0];
  return { title, coord: c ? { lat: c.lat, lng: c.lon } : null };
}

async function pageImage(title: string): Promise<string | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      titles: title,
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "1200",
      format: "json",
    });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const data = (await res.json()) as any;
  const pages = data?.query?.pages ?? {};
  const page: any = Object.values(pages)[0];
  const src: string | undefined = page?.thumbnail?.source;
  if (!src) return null;
  // Only accept files actually hosted under Commons — local enwiki uploads
  // (upload.wikimedia.org/wikipedia/en/...) are usually non-free fair-use.
  if (!src.includes("upload.wikimedia.org/wikipedia/commons/")) return null;
  return src;
}

function replaceImageUrl(text: string, slug: string, url: string): string {
  const marker = `slug: "${slug}"`;
  const start = text.indexOf(marker);
  if (start === -1) return text;
  let end = text.indexOf("\n  {", start);
  if (end === -1) end = text.indexOf("\n];", start);
  if (end === -1) end = text.length;
  const block = text.slice(start, end);
  const patched = block.replace(/imageUrl: (null|"[^"]*")/, `imageUrl: "${url}"`);
  return text.slice(0, start) + patched + text.slice(end);
}

async function run() {
  const key = process.argv[2];
  const targets = key && FILES[key] ? [FILES[key]] : Object.values(FILES);

  const results: any[] = [];
  let totalSet = 0;
  let totalNoImage = 0;
  let totalAlreadySet = 0;

  for (const { file, exportName } of targets) {
    const filePath = path.join(process.cwd(), file);
    const mod = await import(pathToFileURL(filePath).href);
    const places: Place[] = mod[exportName];
    let text = fs.readFileSync(filePath, "utf8");
    let setCount = 0;
    // A distinct real photo shouldn't repeat across different attractions —
    // reuse is a signal we fell back to a generic city/district montage.
    const usedImages = new Set<string>();

    console.log(`\n=== ${file}: ${places.length} places ===`);

    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      if (p.imageUrl) {
        totalAlreadySet++;
        continue;
      }

      try {
        const candidate = await searchCandidate(`${p.name} ${p.district ?? ""} Karnataka`);
        await sleep(120);
        if (!candidate) {
          console.log(`  [${i + 1}/${places.length}] ✗ no wiki page: ${p.name}`);
          results.push({ slug: p.slug, name: p.name, status: "no-title" });
          continue;
        }

        // Verify the matched article is actually about THIS place before
        // trusting its image — same wrong-entity risk as coordinate matching.
        const existing = p.latitude && p.longitude ? { lat: Number(p.latitude), lng: Number(p.longitude) } : null;
        let verified = false;
        let reason = "";
        if (candidate.coord && existing) {
          const d = haversineM(existing, candidate.coord);
          verified = d <= 3000;
          reason = `coord check: ${Math.round(d)}m`;
        } else if (nameOverlaps(p.name, candidate.title)) {
          verified = true;
          reason = "name overlap (no coords to check)";
        } else {
          reason = "no coord + no name overlap";
        }

        if (!verified) {
          console.log(`  [${i + 1}/${places.length}] ✗ rejected match (${reason}): ${p.name} -> ${candidate.title}`);
          results.push({ slug: p.slug, name: p.name, wikiTitle: candidate.title, status: "rejected-mismatch", reason });
          continue;
        }

        const img = await pageImage(candidate.title);
        await sleep(120);
        if (!img) {
          totalNoImage++;
          console.log(`  [${i + 1}/${places.length}] ✗ no commons image: ${p.name} (${candidate.title})`);
          results.push({ slug: p.slug, name: p.name, wikiTitle: candidate.title, status: "no-commons-image" });
          continue;
        }
        if (usedImages.has(img)) {
          console.log(`  [${i + 1}/${places.length}] ✗ rejected (duplicate/generic image already used): ${p.name}`);
          results.push({ slug: p.slug, name: p.name, wikiTitle: candidate.title, status: "rejected-duplicate" });
          continue;
        }
        usedImages.add(img);
        text = replaceImageUrl(text, p.slug, img);
        setCount++;
        totalSet++;
        console.log(`  [${i + 1}/${places.length}] + ${p.name} -> ${img} (${reason})`);
        results.push({ slug: p.slug, name: p.name, wikiTitle: candidate.title, imageUrl: img, status: "set", reason });
      } catch (err) {
        console.log(`  [${i + 1}/${places.length}] ! error ${p.name}: ${(err as Error).message}`);
        results.push({ slug: p.slug, name: p.name, status: "error", error: (err as Error).message });
      }
    }

    if (setCount > 0) {
      fs.writeFileSync(filePath, text);
      console.log(`  -> wrote ${setCount} image URLs to ${file}`);
    }
  }

  const outDir = path.join(process.cwd(), "scripts", ".reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "wikimedia-images-report.json"), JSON.stringify(results, null, 2));

  console.log("\n=== SUMMARY ===");
  console.log(`already had an image: ${totalAlreadySet}`);
  console.log(`newly set: ${totalSet}`);
  console.log(`no Commons image found: ${totalNoImage}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
