import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchDrivingDistancesKm } from "@/lib/google-distance";

export const runtime = "nodejs";

const pointSchema = z.object({ lat: z.number().finite(), lng: z.number().finite() });
const bodySchema = z.object({
  origin: pointSchema,
  destinations: z.array(pointSchema).min(1).max(25),
});

// Real driving distance for a handful of candidate places against the
// traveller's live location, via Google's Distance Matrix API. Keeps the
// (paid, key-holding) call server-side; the client only ever sends/receives
// plain coordinates and distances.
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const distancesKm = await fetchDrivingDistancesKm(parsed.data.origin, parsed.data.destinations);
  return NextResponse.json({ distancesKm });
}
