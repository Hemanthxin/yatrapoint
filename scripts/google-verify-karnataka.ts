// One-time build-time enrichment: cross-checks every Karnataka destination's
// coordinates + opening hours against the Google Places API, and patches the
// SOURCE TS FILES (not just the live DB) so corrections survive `npm run
// db:seed` re-runs. This is a one-off script — the app has no runtime
// dependency on the Google Maps API afterward.
//
// Safety — learned from manual testing: Google's Place Details "geometry"
// point for a large campus (e.g. Bangalore Palace) can be several hundred
// metres off the actual building, sometimes worse than an already-curated
// coordinate. So:
//   • delta <= CONFIDENT_M  -> auto-patch (effectively the same pin either way)
//   • delta  > CONFIDENT_M  -> flag for manual review, do NOT touch the file
//   • no match found        -> flag as unmatched
//
// Opening hours: only auto-patch when Google reports the SAME hours on all 7
// days (the simple, common case for monuments/parks) and it differs from what
// we have. Mixed weekly schedules are flagged instead of guessed at.
//
// Also captures `website` + `editorial_summary` per place into a research
// queue file — leads for the (separate, manual) entry-fee/description pass,
// since Places API has no fee data at all.
//
// Run: npx tsx scripts/google-verify-karnataka.ts [group-a|group-b|...|extra]
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!KEY) {
  console.error("GOOGLE_MAPS_API_KEY missing from .env.local");
  process.exit(1);
}

// Learned from a test batch: sub-2km deltas are consistently the SAME real
// landmark (Google's pin lands on a specific facility/gate within a large
// temple/hill/park complex, backed by real ratings) rather than a wrong
// match — so they're safe to auto-apply. Bigger jumps start to include actual
// wrong-entity matches and need a human to look at the maps link.
const CONFIDENT_M = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Place = {
  slug: string;
  name: string;
  district: string | null;
  latitude: string | null;
  longitude: string | null;
  openingTimings: string | null;
};

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

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function textSearch(query: string): Promise<any | null> {
  const url =
    "https://maps.googleapis.com/maps/api/place/textsearch/json?" +
    new URLSearchParams({ query, key: KEY! }).toString();
  const res = await fetch(url);
  const data = (await res.json()) as any;
  if (data.status !== "OK" || !data.results?.[0]) return null;
  return data.results[0];
}

async function placeDetails(placeId: string): Promise<any | null> {
  const url =
    "https://maps.googleapis.com/maps/api/place/details/json?" +
    new URLSearchParams({
      place_id: placeId,
      fields: "geometry,opening_hours,website,editorial_summary,url,rating,user_ratings_total,name",
      key: KEY!,
    }).toString();
  const res = await fetch(url);
  const data = (await res.json()) as any;
  if (data.status !== "OK") return null;
  return data.result;
}

// Simplify Google's `periods` (which can hold MULTIPLE open/close pairs per
// day — e.g. a temple with a morning and evening darshan session) into the
// same "H:MM AM - H:MM PM[, H:MM AM - H:MM PM]" string style already used in
// the catalogue. Only collapses to one string when every day of the week has
// the identical session pattern; otherwise returns null (needs a human) since
// silently picking one day's schedule would misrepresent the others.
function simplifyHours(opening: any): string | null {
  const periods = opening?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;
  if (periods.length === 1 && !periods[0].close) return "Open 24 hours";

  const fmt = (t: string) => {
    const h = parseInt(t.slice(0, 2), 10);
    const m = t.slice(2);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${ampm}`;
  };

  const byDay: Record<number, any[]> = {};
  for (const p of periods) {
    if (!p.open) continue;
    (byDay[p.open.day] ??= []).push(p);
  }
  const days = Object.keys(byDay).map(Number);
  if (days.length !== 7) return null; // not open every day, or irregular — don't guess

  const dayStrings = days.sort((a, b) => a - b).map((d) => {
    const sessions = byDay[d].slice().sort((a, b) => a.open.time.localeCompare(b.open.time));
    return sessions
      .map((p) => (!p.close ? "24 Hours" : `${fmt(p.open.time)} - ${fmt(p.close.time)}`))
      .join(", ");
  });

  return dayStrings.every((s) => s === dayStrings[0]) ? dayStrings[0] : null;
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
  if (!re.test(block)) return text;
  const patched = block.replace(re, `${field}: "${newValue}"`);
  return text.slice(0, start) + patched + text.slice(end);
}

async function run() {
  const key = process.argv[2];
  const requestedKeys = key ? key.split(",").map((k) => k.trim()) : [];
  const targets =
    requestedKeys.length > 0 && requestedKeys.every((k) => FILES[k])
      ? requestedKeys.map((k) => FILES[k])
      : Object.values(FILES);

  const report: any[] = [];
  const research: any[] = [];

  for (const { file, exportName } of targets) {
    const mod = await import(pathToFileURL(path.join(process.cwd(), file)).href);
    const places: Place[] = mod[exportName];
    let filePath = path.join(process.cwd(), file);
    let text = fs.readFileSync(filePath, "utf8");
    let patchedCount = 0;

    console.log(`\n=== ${file}: ${places.length} places ===`);

    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      const query = `${p.name}, ${p.district ?? ""}, Karnataka, India`;
      let entry: any = { slug: p.slug, name: p.name, district: p.district };

      try {
        const hit = await textSearch(query);
        if (!hit) {
          entry.status = "unmatched";
          console.log(`  [${i + 1}/${places.length}] ✗ no match: ${p.name}`);
          report.push(entry);
          await sleep(120);
          continue;
        }

        const details = await placeDetails(hit.place_id);
        const gLoc = details?.geometry?.location;
        const existing =
          p.latitude && p.longitude ? { lat: Number(p.latitude), lng: Number(p.longitude) } : null;

        entry.googlePlaceId = hit.place_id;
        entry.googleName = hit.name;
        entry.rating = details?.rating;
        entry.userRatingsTotal = details?.user_ratings_total;
        entry.website = details?.website ?? null;
        entry.editorialSummary = details?.editorial_summary?.overview ?? null;
        entry.mapsUrl = details?.url ?? null;

        if (gLoc && existing) {
          const deltaM = haversineM(existing, { lat: gLoc.lat, lng: gLoc.lng });
          entry.existingLatLng = `${existing.lat},${existing.lng}`;
          entry.googleLatLng = `${gLoc.lat},${gLoc.lng}`;
          entry.deltaM = Math.round(deltaM);

          // Below 300m it's clearly the same pin regardless of review count —
          // only gate on a review signal for the riskier 300m-2km band, as a
          // guard against Google matching an obscure, unrelated place that
          // happens to share a generic name.
          const hasReviewSignal = deltaM <= 300 || (details?.user_ratings_total ?? 0) >= 3;

          if (deltaM <= CONFIDENT_M && hasReviewSignal) {
            if (deltaM > 5) {
              text = replaceFieldInBlock(text, p.slug, "latitude", String(gLoc.lat));
              text = replaceFieldInBlock(text, p.slug, "longitude", String(gLoc.lng));
              patchedCount++;
              entry.status = "auto-patched-coords";
            } else {
              entry.status = "already-exact";
            }
          } else {
            entry.status = "FLAGGED-large-delta";
          }
        } else if (gLoc && !existing) {
          text = replaceFieldInBlock(text, p.slug, "latitude", String(gLoc.lat));
          text = replaceFieldInBlock(text, p.slug, "longitude", String(gLoc.lng));
          patchedCount++;
          entry.status = "auto-patched-coords-was-missing";
        } else {
          entry.status = "no-geometry";
        }

        // Only trust hours from a match we've already confirmed is the right
        // entity (same gate as coordinates) — a flagged/wrong-entity match's
        // hours are worthless even if coordinates were correctly left alone.
        const entityConfirmed = entry.status === "already-exact" || entry.status?.startsWith("auto-patched");
        const simpleHours = simplifyHours(details?.opening_hours);
        if (entityConfirmed && simpleHours && simpleHours !== p.openingTimings) {
          entry.existingHours = p.openingTimings;
          entry.googleHours = simpleHours;
          text = replaceFieldInBlock(text, p.slug, "openingTimings", simpleHours);
          entry.hoursPatched = true;
        }

        report.push(entry);
        research.push({
          slug: p.slug,
          name: p.name,
          website: entry.website,
          editorialSummary: entry.editorialSummary,
          mapsUrl: entry.mapsUrl,
        });

        const tag =
          entry.status === "FLAGGED-large-delta"
            ? `⚠ FLAG (${entry.deltaM}m)`
            : entry.status.startsWith("auto-patched")
            ? `~ patched`
            : entry.status === "already-exact"
            ? "= exact"
            : entry.status;
        console.log(`  [${i + 1}/${places.length}] ${tag}: ${p.name}`);
      } catch (err) {
        entry.status = "error";
        entry.error = (err as Error).message;
        report.push(entry);
        console.log(`  [${i + 1}/${places.length}] ! error ${p.name}: ${entry.error}`);
      }

      await sleep(150);
    }

    if (patchedCount > 0) {
      fs.writeFileSync(filePath, text);
      console.log(`  -> wrote ${patchedCount} coordinate fixes to ${file}`);
    }
  }

  const outDir = path.join(process.cwd(), "scripts", ".reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "google-verify-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "research-queue.json"), JSON.stringify(research, null, 2));

  const flagged = report.filter((r) => r.status === "FLAGGED-large-delta");
  const unmatched = report.filter((r) => r.status === "unmatched");
  const patched = report.filter((r) => r.status?.startsWith("auto-patched"));
  const exact = report.filter((r) => r.status === "already-exact");

  console.log("\n=== SUMMARY ===");
  console.log(`total: ${report.length}`);
  console.log(`already exact: ${exact.length}`);
  console.log(`auto-patched coords: ${patched.length}`);
  console.log(`flagged (large delta, needs human eyes): ${flagged.length}`);
  console.log(`unmatched (no Google result): ${unmatched.length}`);
  console.log(`hours patched: ${report.filter((r) => r.hoursPatched).length}`);
  console.log(`\nFull report: scripts/.reports/google-verify-report.json`);
  console.log(`Research queue (website/editorial leads): scripts/.reports/research-queue.json`);

  if (flagged.length > 0) {
    console.log("\n--- FLAGGED for manual review ---");
    for (const f of flagged) {
      console.log(
        `${f.name} (${f.district}): existing ${f.existingLatLng} vs google ${f.googleLatLng} — ${f.deltaM}m — ${f.mapsUrl}`
      );
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
