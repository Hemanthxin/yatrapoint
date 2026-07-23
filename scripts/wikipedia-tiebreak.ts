// Second opinion for the places flagged by google-verify-karnataka.ts as
// "large coordinate delta" — those are genuinely ambiguous: some are a bad
// original guess that Google's search correctly overrode (far distance, but
// Google is right), others are Google matching the WRONG same-named temple
// entirely (e.g. "Sangameshwara Temple" exists in many towns). Distance alone
// can't tell these apart, so this pulls a THIRD coordinate from Wikipedia
// (free, no key) and only auto-resolves when Wikipedia clearly sides with one
// of the two candidates; everything else stays flagged for a human.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const UA = "YatraPoint/1.0 (place data verification; admin@yatrapoint.local)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FILES: Record<string, string> = {
  karnatakaBengaluruRegion: "src/lib/db/karnataka/group-a.ts",
  karnatakaMysuruRegion: "src/lib/db/karnataka/group-b.ts",
  karnatakaMalnadRegion: "src/lib/db/karnataka/group-c.ts",
  karnatakaCoastalRegion: "src/lib/db/karnataka/group-d.ts",
  karnatakaKalyanaRegion: "src/lib/db/karnataka/group-e.ts",
  karnatakaKitturRegion: "src/lib/db/karnataka/group-f.ts",
  karnatakaExtraDestinations: "src/lib/db/india/karnataka-extra.ts",
  centralIndiaDestinations: "src/lib/db/india/central.ts",
  eastIndiaDestinations: "src/lib/db/india/east.ts",
  northIndiaDestinations: "src/lib/db/india/north.ts",
  northeastIndiaDestinations: "src/lib/db/india/northeast.ts",
  northwestIndiaDestinations: "src/lib/db/india/northwest.ts",
  southIndiaDestinations: "src/lib/db/india/south.ts",
  westIndiaDestinations: "src/lib/db/india/west.ts",
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

async function wikiCoord(query: string): Promise<{ lat: number; lng: number; title: string } | null> {
  try {
    const searchUrl =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: query,
        format: "json",
        srlimit: "1",
      });
    const sres = await fetch(searchUrl, { headers: { "User-Agent": UA } });
    const sdata = (await sres.json()) as any;
    const title = sdata?.query?.search?.[0]?.title;
    if (!title) return null;

    const coordUrl =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        prop: "coordinates",
        titles: title,
        format: "json",
      });
    const cres = await fetch(coordUrl, { headers: { "User-Agent": UA } });
    const cdata = (await cres.json()) as any;
    const pages = cdata?.query?.pages ?? {};
    const page: any = Object.values(pages)[0];
    const coord = page?.coordinates?.[0];
    if (!coord) return null;
    return { lat: coord.lat, lng: coord.lon, title };
  } catch {
    return null;
  }
}

function replaceFieldInBlock(text: string, slug: string, field: string, newValue: string): string {
  const marker = `slug: "${slug}"`;
  const start = text.indexOf(marker);
  if (start === -1) return text;
  let end = text.indexOf("\n  {", start);
  if (end === -1) end = text.indexOf("\n];", start);
  if (end === -1) end = text.length;
  const block = text.slice(start, end);
  const re = new RegExp(`${field}: "[^"]*"`);
  const patched = block.replace(re, `${field}: "${newValue}"`);
  return text.slice(0, start) + patched + text.slice(end);
}

async function run() {
  const reportPath = path.join(process.cwd(), "scripts", ".reports", "google-verify-report.json");
  const report: any[] = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const flagged = report.filter((r) => r.status === "FLAGGED-large-delta");

  // Build slug -> source file map.
  const slugToFile: Record<string, string> = {};
  for (const [exportName, file] of Object.entries(FILES)) {
    const mod = await import(pathToFileURL(path.join(process.cwd(), file)).href);
    for (const p of mod[exportName]) slugToFile[p.slug] = file;
  }

  const fileTextCache: Record<string, string> = {};
  const results: any[] = [];
  let resolvedExisting = 0;
  let resolvedGoogle = 0;
  let stillAmbiguous = 0;

  for (let i = 0; i < flagged.length; i++) {
    const f = flagged[i];
    const [eLat, eLng] = f.existingLatLng.split(",").map(Number);
    const [gLat, gLng] = f.googleLatLng.split(",").map(Number);
    const existing = { lat: eLat, lng: eLng };
    const google = { lat: gLat, lng: gLng };

    const wiki = await wikiCoord(`${f.name} ${f.district} Karnataka`);
    let verdict = "no-wiki-data";

    if (wiki) {
      const wikiPt = { lat: wiki.lat, lng: wiki.lng };
      const dExisting = haversineM(existing, wikiPt);
      const dGoogle = haversineM(google, wikiPt);

      if (dExisting <= 1500 && dExisting < dGoogle) {
        verdict = "confirms-existing";
        resolvedExisting++;
      } else if (dGoogle <= 1500 && dGoogle < dExisting) {
        verdict = "confirms-google";
        resolvedGoogle++;
        const file = slugToFile[f.slug];
        if (file) {
          fileTextCache[file] = fileTextCache[file] ?? fs.readFileSync(path.join(process.cwd(), file), "utf8");
          fileTextCache[file] = replaceFieldInBlock(fileTextCache[file], f.slug, "latitude", String(gLat));
          fileTextCache[file] = replaceFieldInBlock(fileTextCache[file], f.slug, "longitude", String(gLng));
        }
      } else {
        verdict = "ambiguous";
        stillAmbiguous++;
      }
    } else {
      stillAmbiguous++;
    }

    results.push({
      slug: f.slug,
      name: f.name,
      district: f.district,
      existingLatLng: f.existingLatLng,
      googleLatLng: f.googleLatLng,
      deltaM: f.deltaM,
      wikiTitle: wiki?.title ?? null,
      wikiLatLng: wiki ? `${wiki.lat},${wiki.lng}` : null,
      verdict,
      mapsUrl: f.mapsUrl,
    });

    console.log(`[${i + 1}/${flagged.length}] ${verdict}: ${f.name}${wiki ? ` (wiki: ${wiki.title})` : ""}`);
    await sleep(150);
  }

  for (const [file, text] of Object.entries(fileTextCache)) {
    fs.writeFileSync(path.join(process.cwd(), file), text);
  }

  fs.writeFileSync(
    path.join(process.cwd(), "scripts", ".reports", "wikipedia-tiebreak-report.json"),
    JSON.stringify(results, null, 2)
  );

  console.log("\n=== SUMMARY ===");
  console.log(`flagged reviewed: ${flagged.length}`);
  console.log(`confirmed existing was right (no change): ${resolvedExisting}`);
  console.log(`confirmed Google was right (patched): ${resolvedGoogle}`);
  console.log(`still ambiguous / no Wikipedia data: ${stillAmbiguous}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
