import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cityPlaces, destinations, nearbyDestinations } from "@/lib/db/schema";
import { haversineKm } from "@/lib/geo";
import { isVisiblePlace } from "@/lib/place-visibility";
import { PlaceDeduper, SOURCE_PRIORITY } from "@/lib/place-dedup";

export const runtime = "nodejs";

// Curated places WITHIN a radius of the user, unioned across every catalogue
// table so it works ANYWHERE in India — not just Bengaluru:
//   • city_places        (~10k, Bengaluru-heavy) — bounded by a lat/lng box so
//                          the large table stays a tiny scan.
//   • destinations       (~634, nationwide) — fetched whole (small) + filtered.
//   • nearby_destinations (~50, day trips)   — fetched whole + filtered.
// The result is a normalised list, nearest-first.
const querySchema = z.object({
  lat: z.coerce.number().finite().gte(-90).lte(90),
  lng: z.coerce.number().finite().gte(-180).lte(180),
  radiusKm: z.coerce.number().min(1).max(400).default(30),
  limit: z.coerce.number().int().min(1).max(1200).default(24),
  // Optional comma-separated city_places `kind` values (e.g. "mall,market").
  // Applied BEFORE the distance sort + limit — without this, a category like
  // malls (a few dozen citywide) can get squeezed out entirely by the nearest
  // `limit` restaurants/temples (thousands citywide) before filtering ever runs.
  kinds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null)),
});

export interface NearPlace {
  id: string;
  name: string;
  slug: string;
  source: "city" | "destination" | "nearby";
  category: string | null;
  kind: string | null;
  area: string | null;
  imageUrl: string | null;
  latitude: string;
  longitude: string;
  distanceKm: number;
}

const numeric = (v: string | null) => {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    lat: sp.get("lat"),
    lng: sp.get("lng"),
    radiusKm: sp.get("radiusKm") ?? undefined,
    limit: sp.get("limit") ?? undefined,
    kinds: sp.get("kinds") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { lat, lng, radiusKm, limit, kinds } = parsed.data;
  const centre = { lat, lng };
  // Bounding box around the user (a little wider than the radius so the corners
  // aren't clipped before the exact circular filter below).
  const dLat = radiusKm / 111 + 0.02;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))) + 0.02;

  try {
    // city_places: SQL bounding box keeps the ~10k-row scan tiny. When `kinds`
    // is given, filter by it IN THE SAME QUERY — filtering after the bounding
    // box (or after the final distance-sort limit) would let a dense category
    // like restaurants crowd out a rare one like malls before it's ever seen.
    const cityRows = await db
      .select()
      .from(cityPlaces)
      .where(
        and(
          sql`CAST(${cityPlaces.latitude} AS double precision) BETWEEN ${lat - dLat} AND ${lat + dLat}`,
          sql`CAST(${cityPlaces.longitude} AS double precision) BETWEEN ${lng - dLng} AND ${lng + dLng}`,
          kinds ? inArray(cityPlaces.kind, kinds) : undefined
        )
      )
      .limit(1500);

    // Small nationwide tables — fetch whole, filter in JS (avoids casting the
    // occasional blank/invalid coordinate in SQL).
    const [destRows, nearRows] = await Promise.all([
      db.select().from(destinations),
      db.select().from(nearbyDestinations),
    ]);

    const all: NearPlace[] = [];

    for (const r of cityRows) {
      const la = numeric(r.latitude);
      const lo = numeric(r.longitude);
      if (la == null || lo == null) continue;
      if (!isVisiblePlace(r)) continue;
      all.push({
        id: r.id, name: r.name, slug: r.slug, source: "city",
        category: r.category, kind: r.kind, area: r.area || r.city || null,
        imageUrl: r.imageUrl, latitude: r.latitude!, longitude: r.longitude!,
        distanceKm: haversineKm(centre, { lat: la, lng: lo }),
      });
    }
    for (const r of destRows) {
      const la = numeric(r.latitude);
      const lo = numeric(r.longitude);
      if (la == null || lo == null) continue;
      if (r.isHidden || !isVisiblePlace(r)) continue;
      all.push({
        id: r.id, name: r.name, slug: r.slug, source: "destination",
        category: r.category, kind: r.placeType ?? null,
        area: [r.district, r.state].filter(Boolean).join(", ") || null,
        imageUrl: r.imageUrl, latitude: r.latitude!, longitude: r.longitude!,
        distanceKm: haversineKm(centre, { lat: la, lng: lo }),
      });
    }
    for (const r of nearRows) {
      const la = numeric(r.latitude);
      const lo = numeric(r.longitude);
      if (la == null || lo == null) continue;
      if (!isVisiblePlace(r)) continue;
      all.push({
        id: r.id, name: r.name, slug: r.slug, source: "nearby",
        category: r.category, kind: null, area: `From ${r.baseCity}`,
        imageUrl: r.imageUrl, latitude: r.latitude, longitude: r.longitude,
        distanceKm: haversineKm(centre, { lat: la, lng: lo }),
      });
    }

    // The three catalogues overlap: a well-known place is very often present in
    // more than one of them (and under slightly different names/coordinates),
    // which is what made the same place appear several times in one result set
    // (BUG-01). De-duplicate AFTER the distance sort so the nearest copy wins
    // the position, and let source priority decide which row survives — a
    // curated/manually-added row always beats a bulk-seeded one (BUG-02).
    const deduper = new PlaceDeduper<NearPlace & { lat: number; lng: number }>((p) =>
      p.source === "destination"
        ? SOURCE_PRIORITY.destination
        : p.source === "nearby"
        ? SOURCE_PRIORITY.nearby
        : SOURCE_PRIORITY.city
    );
    for (const p of all.filter((p) => p.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm)) {
      deduper.add({ ...p, lat: Number(p.latitude), lng: Number(p.longitude) });
      if (deduper.size >= limit) break;
    }
    const places: NearPlace[] = deduper.items.map(({ lat: _lat, lng: _lng, ...p }) => p);

    return NextResponse.json({ ok: true, count: places.length, places });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Query failed" },
      { status: 500 }
    );
  }
}
