import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { fetchRoute } from "@/lib/routing";

export const runtime = "nodejs";

// Re-route an existing (possibly edited) set of stops through real roads. Used
// when the traveller swaps a stop for another place — we keep the same start,
// route start → stops → start, and return geometry + per-leg metrics so the UI
// can refresh the map and recompute distances/costs without a full re-plan.
const bodySchema = z.object({
  start: z.object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  }),
  stops: z
    .array(
      z.object({
        lat: z.number().gte(-90).lte(90),
        lng: z.number().gte(-180).lte(180),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const waypoints = [parsed.data.start, ...parsed.data.stops, parsed.data.start];
  const route = await fetchRoute(waypoints);
  if (!route) {
    return NextResponse.json({ ok: false, error: "Could not build a route." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    geometry: route.geometry,
    legs: route.legs,
  });
}
