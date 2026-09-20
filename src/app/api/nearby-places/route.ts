import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { haversineKm } from "@/lib/geo";
import { isVisiblePlace } from "@/lib/place-visibility";
import { PLACE_KINDS, hasKind, kindsOf, notPermanentlyClosed } from "@/lib/queries/places";

export const runtime = "nodejs";

// Curated places WITHIN a radius of the user, nearest first.
//
// This used to union three overlapping tables and then de-duplicate the result,
// which is how the same place kept appearing two or three times in one list. It
// now reads the single `places` catalogue, so a place can only be returned
// once — the duplication is gone structurally rather than filtered out.
const querySchema = z.object({
  lat: z.coerce.number().finite().gte(-90).lte(90),
  lng: z.coerce.number().finite().gte(-180).lte(180),
  radiusKm: z.coerce.number().min(1).max(400).default(30),
  limit: z.coerce.number().int().min(1).max(1200).default(24),
  // Optional comma-separated city `kind` values (e.g. "mall,market"). Applied
  // in SQL, BEFORE the distance sort and limit — without this a category like
  // malls (a few dozen citywide) gets squeezed out entirely by the nearest
  // `limit` restaurants/temples (thousands citywide) before filtering runs.
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
  // Bounding box around the user, a little wider than the radius so the corners
  // aren't clipped before the exact circular filter below.
  const dLat = radiusKm / 111 + 0.02;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))) + 0.02;

  try {
    const rows = await db
      .select()
      .from(places)
      .where(
        and(
          notPermanentlyClosed,
          sql`${places.isHidden} = false`,
          sql`CAST(${places.latitude} AS double precision) BETWEEN ${lat - dLat} AND ${lat + dLat}`,
          sql`CAST(${places.longitude} AS double precision) BETWEEN ${lng - dLng} AND ${lng + dLng}`,
          // A `kinds` filter targets the city taxonomy, so it must also let
          // through destinations and day trips, which have no city kind.
          kinds
            ? or(
                inArray(places.cityKind, kinds),
                hasKind(PLACE_KINDS.destination),
                hasKind(PLACE_KINDS.dayTrip)
              )
            : undefined
        )
      )
      .limit(2000);

    // The place's most specific catalogue decides which detail page it links
    // to: a destination page is richer than a day-trip page, which is richer
    // than a city listing.
    const sourceOf = (p: (typeof rows)[number]): NearPlace["source"] => {
      const k = kindsOf(p);
      if (k.includes(PLACE_KINDS.destination)) return "destination";
      if (k.includes(PLACE_KINDS.dayTrip)) return "nearby";
      return "city";
    };

    const all: NearPlace[] = [];
    for (const r of rows) {
      const la = numeric(r.latitude);
      const lo = numeric(r.longitude);
      if (la == null || lo == null) continue;
      if (!isVisiblePlace(r)) continue;
      const source = sourceOf(r);
      all.push({
        id: r.id,
        name: r.name,
        slug: r.slug,
        source,
        category: r.category,
        kind: r.cityKind ?? r.placeType ?? null,
        area:
          source === "destination"
            ? [r.district, r.state].filter(Boolean).join(", ") || null
            : source === "nearby"
            ? `From ${r.baseCity ?? "Bangalore"}`
            : r.area || r.city || null,
        imageUrl: r.imageUrl,
        latitude: r.latitude!,
        longitude: r.longitude!,
        distanceKm: haversineKm(centre, { lat: la, lng: lo }),
      });
    }

    const result = all
      .filter((p) => p.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return NextResponse.json({ ok: true, count: result.length, places: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Query failed" },
      { status: 500 }
    );
  }
}
