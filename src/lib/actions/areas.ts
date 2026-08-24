"use server";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { destinations } from "@/lib/db/schema";
import { INDIA_STATES } from "@/lib/india-states";
import { INDIA_DISTRICTS } from "@/lib/india-districts";
import { runOverpassQuery } from "@/lib/overpass";
import { districtInList, districtMatches } from "@/lib/district-match";
import { dedupePlaces, SOURCE_PRIORITY } from "@/lib/place-dedup";
import { isVisiblePlace } from "@/lib/place-visibility";

export interface AreaCenter {
  lat: number;
  lng: number;
  // Suggested search radius in km, derived from the area's bounding box.
  radiusKm: number;
  label: string;
}

export interface AreaPlace {
  id: string;
  name: string;
  district: string | null;
  category: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
}

// Simple in-process cache so re-opening the dropdowns doesn't re-hit Overpass.
const childCache = new Map<string, { at: number; value: string[] }>();
const CHILD_TTL_MS = 30 * 60_000;

function cacheGet(key: string): string[] | null {
  const hit = childCache.get(key);
  if (hit && Date.now() - hit.at < CHILD_TTL_MS) return hit.value;
  return null;
}
function cacheSet(key: string, value: string[]) {
  childCache.set(key, { at: Date.now(), value });
}

// Escape a name for use inside an Overpass QL string literal.
function ql(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}

function uniqueSorted(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export async function listStatesAction(): Promise<string[]> {
  return INDIA_STATES;
}

// The OSM admin_level for "district" and "taluk" is NOT the same across India:
// e.g. Karnataka maps districts at level 5 and taluks at level 6, while most
// states use 6 for districts and 7 for taluks (and some add a level-5 "division"
// above districts). So instead of guessing a fixed level, we fetch every
// boundary below the state once and figure out which level is districts and
// which is taluks — by spotting the level whose names are mostly taluk-like.
interface StateLevels {
  districtLevel: number;
  talukLevel: number | null;
  districts: string[];
}
const stateCache = new Map<string, { at: number; value: StateLevels }>();

// Names that signal a sub-district / taluk / tehsil tier rather than a district.
// Substring matches on purpose so spelling variants (taluk / taluka / taluku /
// taluq / tehsil / tahsil) are all caught.
const TALUK_MARKER =
  /(taluk|taluq|tehsil|tahsil|mandal|sub[-\s]?divis|sub[-\s]?distric|\bcircle\b|firka)/i;

async function detectStateLevels(state: string): Promise<StateLevels> {
  const cached = stateCache.get(state);
  if (cached && Date.now() - cached.at < CHILD_TTL_MS) return cached.value;

  // One query for the administrative boundaries (levels 5-7) inside the state —
  // enough to tell districts from taluks without pulling level-8 village data.
  const q = `[out:json][timeout:120];
    area["boundary"="administrative"]["admin_level"="4"]["name"="${ql(state)}"]->.s;
    relation(area.s)["boundary"="administrative"]["admin_level"~"^[567]$"];
    out tags;`;
  const els = await runOverpassQuery(q);

  const byLevel = new Map<number, string[]>();
  for (const e of els) {
    const lvl = Number(e.tags?.admin_level);
    const name = e.tags?.name?.trim();
    if (!Number.isFinite(lvl) || !name) continue;
    const arr = byLevel.get(lvl) ?? [];
    arr.push(name);
    byLevel.set(lvl, arr);
  }

  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  // Taluk level = the shallowest level whose names are mostly taluk-like.
  let talukLevel: number | null = null;
  for (const lvl of levels) {
    const names = byLevel.get(lvl)!;
    const frac = names.filter((n) => TALUK_MARKER.test(n)).length / names.length;
    if (frac > 0.4) {
      talukLevel = lvl;
      break;
    }
  }

  // District level = the deepest level above the taluk level (so a level-5
  // "division" is skipped in favour of the level-6 districts when both exist).
  let districtLevel: number;
  if (talukLevel != null) {
    const below = levels.filter((l) => l < talukLevel! && l >= 5);
    districtLevel = below.length ? Math.max(...below) : talukLevel;
  } else {
    districtLevel = byLevel.has(6) ? 6 : byLevel.has(5) ? 5 : levels[0] ?? 6;
  }

  const districts = uniqueSorted(byLevel.get(districtLevel) ?? []);
  const value: StateLevels = { districtLevel, talukLevel, districts };
  stateCache.set(state, { at: Date.now(), value });
  return value;
}

// District-name comparison lives in @/lib/district-match so the dropdown, the
// catalogue filter and the planner all agree on what counts as the same
// district (BUG-09). It notably does NOT strip "Rural"/"Urban", which the old
// local normaliser here did — that merged Bengaluru Rural into Bengaluru Urban.

// Districts of a state. Prefer the curated authoritative list (OSM admin data is
// incomplete — e.g. missing Ramanagara) and fall back to live OSM detection for
// states we haven't curated yet.
export async function listDistricts(state: string): Promise<string[]> {
  if (!INDIA_STATES.includes(state)) return [];
  const curated = INDIA_DISTRICTS[state];
  if (curated && curated.length) return [...curated].sort((a, b) => a.localeCompare(b));
  try {
    return (await detectStateLevels(state)).districts;
  } catch {
    return [];
  }
}

// Taluks / tehsils / sub-districts inside a chosen district. Uses the detected
// district + taluk levels for the state so it works whichever way the state is
// mapped (Karnataka 5/6, most others 6/7).
export async function listTaluks(
  state: string,
  district: string
): Promise<string[]> {
  const key = `t:${state}:${district}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  if (!INDIA_STATES.includes(state) || !district.trim()) return [];

  try {
    const lv = await detectStateLevels(state);
    if (lv.talukLevel == null) return [];

    // The curated district name may differ from OSM's spelling (e.g. "Mysuru"
    // vs OSM "Mysuru District"). Bridge to the matching OSM boundary name so the
    // taluk query resolves. If there's no OSM district to match (e.g. Ramanagara
    // isn't in OSM), there are no taluks to fetch — return empty gracefully.
    // Exact match on the canonical key — the old prefix test in both
    // directions could bridge to a DIFFERENT district whose name merely starts
    // the same way, and then fetch that district's taluks (BUG-09).
    const osmName = lv.districts.find((d) => districtMatches(d, district)) ?? null;
    if (!osmName) return [];

    const q = `[out:json][timeout:120];
      area["boundary"="administrative"]["admin_level"="4"]["name"="${ql(state)}"]->.s;
      relation(area.s)["boundary"="administrative"]["admin_level"="${lv.districtLevel}"]["name"="${ql(osmName)}"];
      map_to_area->.d;
      relation(area.d)["boundary"="administrative"]["admin_level"="${lv.talukLevel}"];
      out tags;`;
    const els = await runOverpassQuery(q);
    const names = uniqueSorted(els.map((e) => e.tags?.name ?? "").filter(Boolean));
    cacheSet(key, names);
    return names;
  } catch {
    return [];
  }
}

// Geocode an area (taluk / district / state) to a centre + a sensible search
// radius via Nominatim. Builds the query most-specific-first so the centre lands
// inside the chosen area. No auth gate — area planning is for every traveller.
export async function geocodeArea(parts: {
  state: string;
  district?: string;
  taluk?: string;
}): Promise<AreaCenter | null> {
  const q = [parts.taluk, parts.district, parts.state, "India"]
    .filter(Boolean)
    .join(", ");
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      format: "jsonv2",
      q,
      limit: "1",
      countrycodes: "in",
      addressdetails: "0",
    }).toString();

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "YatraPoint/1.0 (area trip planning)",
        Accept: "application/json",
      },
      // Area centres are stable — let Next cache them at the data layer.
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      boundingbox?: [string, string, string, string]; // [south, north, west, east]
    }>;
    const r = rows[0];
    if (!r) return null;

    const lat = Number(r.lat);
    const lng = Number(r.lon);

    // Nominatim usually returns the town POINT for a taluk (a tiny bbox), so we
    // can't rely on the bbox alone — a real taluk spans ~25 km and a district
    // ~55 km, so we FLOOR the radius to that and only widen for genuinely large
    // bboxes (states). Capped so a taluk/district still won't spill far into
    // neighbours; the district-name filter keeps the curated catalogue precise.
    const floorKm = parts.taluk ? 25 : parts.district ? 55 : 60;
    const cap = parts.taluk ? 30 : parts.district ? 70 : 250;
    let radiusKm = floorKm;
    const bb = r.boundingbox;
    if (bb && bb.length === 4) {
      const [s, n, w, e] = bb.map(Number);
      const latKm = Math.abs(n - s) * 111;
      const lngKm = Math.abs(e - w) * 111 * Math.cos((lat * Math.PI) / 180);
      const diagHalf = Math.sqrt(latKm * latKm + lngKm * lngKm) / 2;
      if (Number.isFinite(diagHalf) && diagHalf > 0) {
        radiusKm = Math.min(cap, Math.max(floorKm, diagHalf));
      }
    }
    radiusKm = Math.min(500, Math.max(5, Math.round(radiusKm)));

    return { lat, lng, radiusKm, label: r.display_name };
  } catch {
    return null;
  }
}

// Curated catalogue places inside the chosen area — these populate the
// "pick specific places" multi-select. Filters by state and, when districts are
// chosen, by those districts. Only visible places with real coordinates.
export async function listAreaPlaces(
  state: string,
  districts: string[] = []
): Promise<AreaPlace[]> {
  if (!state.trim()) return [];

  // The district filter is applied in JS, not as `inArray(district, …)` in SQL.
  // The dropdown is built from the curated INDIA_DISTRICTS spellings while the
  // catalogue rows carry the other common spelling of the same district, so an
  // exact SQL string match returned NOTHING for districts like Bagalkot(e) or
  // Chikkaballapur(a) (BUG-09). One state's places are a small set, so
  // filtering them here costs nothing and is correct.
  const rows = await db
    .select({
      id: destinations.id,
      name: destinations.name,
      district: destinations.district,
      category: destinations.category,
      latitude: destinations.latitude,
      longitude: destinations.longitude,
      imageUrl: destinations.imageUrl,
      googleBusinessStatus: destinations.googleBusinessStatus,
    })
    .from(destinations)
    .where(
      and(
        eq(destinations.state, state),
        eq(destinations.isHidden, false),
        sql`${destinations.latitude} is not null`,
        sql`${destinations.longitude} is not null`
      )
    )
    .orderBy(destinations.name)
    .limit(2000);

  const places = rows
    .filter((r) => isVisiblePlace(r))
    .filter((r) => districtInList(r.district, districts))
    .map((r) => ({
      id: r.id,
      name: r.name,
      district: r.district,
      category: r.category,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      imageUrl: r.imageUrl,
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  // Two rows for the same real place would otherwise appear as two separate
  // tick-boxes in the picker (BUG-01).
  return dedupePlaces(places, () => SOURCE_PRIORITY.destination).slice(0, 500);
}
