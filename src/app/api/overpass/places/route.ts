import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchOverpassPlaces, type OverpassCategory } from "@/lib/overpass";

export const runtime = "nodejs";
// Give the mirror race room to finish (default serverless limits can be ~10s,
// which cut the query off before Overpass replied).
export const maxDuration = 30;
// Cache responses at the HTTP edge — Overpass results don't change minute-to-
// minute and this saves the upstream server from repeated identical queries.
export const revalidate = 300;

const ALL_CATS: OverpassCategory[] = [
  "restaurant",
  "cafe",
  "fast_food",
  "nightlife",
  "mall",
  "marketplace",
  "temple",
  "church",
  "mosque",
  "gurudwara",
  "place_of_worship",
  "park",
  "garden",
  "museum",
  "viewpoint",
  "monument",
  "fort",
  "lake",
  "tourist_attraction",
  "cinema",
  "theatre",
  "zoo",
  "amusement",
];

const querySchema = z.object({
  lat: z.coerce.number().finite().gte(-90).lte(90),
  lng: z.coerce.number().finite().gte(-180).lte(180),
  radius: z.coerce.number().int().min(100).max(50_000).optional(),
  // Comma-separated list of categories from ALL_CATS.
  categories: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    lat: sp.get("lat"),
    lng: sp.get("lng"),
    radius: sp.get("radius") ?? undefined,
    categories: sp.get("categories"),
    limit: sp.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const wanted = parsed.data.categories
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is OverpassCategory =>
      (ALL_CATS as string[]).includes(s)
    );

  if (wanted.length === 0) {
    return NextResponse.json(
      { error: "No valid categories specified" },
      { status: 400 }
    );
  }

  try {
    const places = await fetchOverpassPlaces({
      centre: { lat: parsed.data.lat, lng: parsed.data.lng },
      radius: parsed.data.radius,
      categories: wanted,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ ok: true, count: places.length, places });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Overpass query failed",
      },
      { status: 502 }
    );
  }
}
