import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { answerAssistantQuestion } from "@/lib/ai/saafera-assistant";

export const runtime = "nodejs";

interface IncomingMessage {
  role?: unknown;
  content?: unknown;
}

// No external AI API — answers come from a hard-coded, accurate description
// of the app plus real rows from the `places` table (see
// @/lib/ai/saafera-assistant), so a reply can never invent a feature or a
// place that doesn't exist.
export async function POST(req: NextRequest) {
  let raw: { messages?: IncomingMessage[]; location?: { lat?: unknown; lng?: unknown } | null };
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const incoming = Array.isArray(raw.messages) ? raw.messages : [];
  const lastUser = [...incoming]
    .reverse()
    .find((m): m is { role: "user"; content: string } => m?.role === "user" && typeof m?.content === "string");

  if (!lastUser || !lastUser.content.trim()) {
    return NextResponse.json({ error: "No question to answer." }, { status: 400 });
  }

  const lat = raw.location?.lat;
  const lng = raw.location?.lng;
  const origin = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : null;

  const session = await auth();
  const reply = await answerAssistantQuestion(lastUser.content.slice(0, 2000), {
    userId: session?.user?.id ?? null,
    origin,
  });

  return NextResponse.json({ reply });
}
