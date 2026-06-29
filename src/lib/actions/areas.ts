"use server";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { destinations } from "@/lib/db/schema";
import { INDIA_STATES } from "@/lib/india-states";
import { runOverpassQuery } from "@/lib/overpass";

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

// Districts of a state — OSM admin_level=6 boundaries inside the state polygon.
// Falls back to admin_level=5 for the few states that map districts there.
export async function listDistricts(state: string): Promise<string[]> {
  const key = `d:${state}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  if (!INDIA_STATES.includes(state)) return [];

  const build = (level: number) => `
    [out:json][timeout:60];
    area["boundary"="administrative"]["admin_level"="4"]["name"="${ql(state)}"]->.s;
    relation(area.s)["boundary"="administrative"]["admin_level"="${level}"];
    out tags;`;

  try {
    let els = await runOverpassQuery(build(6));
    let names = uniqueSorted(els.map((e) => e.tags?.name ?? "").filter(Boolean));
    if (names.length === 0) {
      els = await runOverpassQuery(build(5));
      names = uniqueSorted(els.map((e) => e.tags?.name ?? "").filter(Boolean));
    }
    cacheSet(key, names);
    return names;
  } catch {
    return [];
  }
}

// Taluks / tehsils / sub-districts of a district — OSM admin_level=7 inside the
// district polygon (scoped to the state to avoid same-named district clashes).
// Falls back to admin_level=8 where taluks aren't mapped at 7.
export async function listTaluks(
  state: string,
  district: string
): Promise<string[]> {
  const key = `t:${state}:${district}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  if (!INDIA_STATES.includes(state) || !district.trim()) return [];

  const build = (level: number) => `
    [out:json][timeout:90];
    area["boundary"="administrative"]["admin_level"="4"]["name"="${ql(state)}"]->.s;
    relation(area.s)["boundary"="administrative"]["admin_level"="6"]["name"="${ql(district)}"];
    map_to_area->.d;
    relation(area.d)["boundary"="administrative"]["admin_level"="${level}"];
    out tags;`;

  try {
    let els = await runOverpassQuery(build(7));
    let names = uniqueSorted(els.map((e) => e.tags?.name ?? "").filter(Boolean));
    if (names.length === 0) {
      els = await runOverpassQuery(build(8));
      names = uniqueSorted(els.map((e) => e.tags?.name ?? "").filter(Boolean));
    }
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

    // Radius ≈ half the bounding-box diagonal, so a whole state gets a big radius
    // and a single taluk a small one. Clamped to the planner's accepted range.
    let radiusKm = parts.taluk ? 15 : parts.district ? 40 : 120;
    const bb = r.boundingbox;
    if (bb && bb.length === 4) {
      const [s, n, w, e] = bb.map(Number);
      const latKm = Math.abs(n - s) * 111;
      const lngKm = Math.abs(e - w) * 111 * Math.cos((lat * Math.PI) / 180);
      const diagHalf = Math.sqrt(latKm * latKm + lngKm * lngKm) / 2;
      if (Number.isFinite(diagHalf) && diagHalf > 0) radiusKm = diagHalf;
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
  const where = [
    eq(destinations.state, state),
    eq(destinations.isHidden, false),
    sql`${destinations.latitude} is not null`,
    sql`${destinations.longitude} is not null`,
  ];
  if (districts.length > 0) {
    where.push(inArray(destinations.district, districts));
  }

  const rows = await db
    .select({
      id: destinations.id,
      name: destinations.name,
      district: destinations.district,
      category: destinations.category,
      latitude: destinations.latitude,
      longitude: destinations.longitude,
    })
    .from(destinations)
    .where(and(...where))
    .orderBy(destinations.name)
    .limit(500);

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      district: r.district,
      category: r.category,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}
