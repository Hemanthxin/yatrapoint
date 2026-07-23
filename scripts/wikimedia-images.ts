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
  central: { file: "src/lib/db/india/central.ts", exportName: "centralIndiaDestinations" },
  east: { file: "src/lib/db/india/east.ts", exportName: "eastIndiaDestinations" },
  north: { file: "src/lib/db/india/north.ts", exportName: "northIndiaDestinations" },
  northeast: { file: "src/lib/db/india/northeast.ts", exportName: "northeastIndiaDestinations" },
  northwest: { file: "src/lib/db/india/northwest.ts", exportName: "northwestIndiaDestinations" },
  south: { file: "src/lib/db/india/south.ts", exportName: "southIndiaDestinations" },
  west: { file: "src/lib/db/india/west.ts", exportName: "westIndiaDestinations" },
};

type Place = {
  slug: string;
  name: string;
  state: string;
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
// Rejects a match that's really just the surrounding city/district/state
// article rather than the specific attraction — e.g. "Puri Beach" in Puri
// district searched as "Puri Beach Puri Odisha" ranks the generic "Puri
// (city)" article first because the district word doubles up with the name.
// A generic area page's lead image (often a famous landmark, a flag, or a
// map) is almost never a correct photo for the specific place.
function isGenericAreaTitle(title: string, place: { name: string; district: string | null; state: string }): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const t = norm(title);
  const bareAreaNames = [place.district, place.state, `${place.district} district`, `${place.district} city`]
    .filter((s): s is string => !!s)
    .map(norm);
  if (!bareAreaNames.includes(t)) return false;
  // Not generic if the place itself basically IS that area (rare, but valid).
  return norm(place.name) !== t;
}

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
  // A page's "lead image" is sometimes a flag, coat of arms, logo, map or a
  // generic multi-photo montage rather than an actual photo of the place —
  // none of those are useful as a destination card's hero image.
  if (/flag_of|_flag\.|logo|map_of|_map\.|montage|coat_of_arms|seal_of|emblem|\.svg/i.test(src)) {
    return null;
  }
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
        const candidate = await searchCandidate(`${p.name} ${p.district ?? ""} ${p.state}`);
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
        if (isGenericAreaTitle(candidate.title, p)) {
          reason = `generic area page, not the specific place: "${candidate.title}"`;
        } else if (candidate.coord && existing) {
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
