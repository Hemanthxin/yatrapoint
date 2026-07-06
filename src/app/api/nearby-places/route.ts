import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cityPlaces } from "@/lib/db/schema";
import { haversineKm } from "@/lib/geo";

export const runtime = "nodejs";

// Curated seed places WITHIN a radius of the user — from the FULL catalogue
// (~10k rows), not a fixed popularity slice. A latitude/longitude bounding box
// keeps the DB scan tiny (only rows near the box), so it stays fast even though
// the table is large. The client then filters to the exact radius and sorts.
const querySchema = z.object({
  lat: z.coerce.number().finite().gte(-90).lte(90),
  lng: z.coerce.number().finite().gte(-180).lte(180),
  radiusKm: z.coerce.number().min(1).max(300).default(8),
  limit: z.coerce.number().int().min(1).max(1200).default(800),
});

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    lat: sp.get("lat"),
    lng: sp.get("lng"),
    radiusKm: sp.get("radiusKm") ?? undefined,
    limit: sp.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { lat, lng, radiusKm, limit } = parsed.data;
  // Bounding box around the user (a little wider than the radius so the corners
  // aren't clipped before the exact circular filter below).
  const dLat = radiusKm / 111 + 0.02;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))) + 0.02;

  try {
    const rows = await db
      .select()
      .from(cityPlaces)
      .where(
        and(
          sql`CAST(${cityPlaces.latitude} AS double precision) BETWEEN ${lat - dLat} AND ${lat + dLat}`,
          sql`CAST(${cityPlaces.longitude} AS double precision) BETWEEN ${lng - dLng} AND ${lng + dLng}`
        )
      )
      .limit(1500);

    // Exact circular filter + nearest-first, capped.
    const places = rows
      .map((r) => ({ r, d: haversineKm({ lat, lng }, { lat: Number(r.latitude), lng: Number(r.longitude) }) }))
      .filter((x) => Number.isFinite(x.d) && x.d <= radiusKm)
      .sort((a, b) => a.d - b.d)
      .slice(0, limit)
      .map((x) => x.r);

    return NextResponse.json({ ok: true, count: places.length, places });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Query failed" },
      { status: 500 }
    );
  }
}
