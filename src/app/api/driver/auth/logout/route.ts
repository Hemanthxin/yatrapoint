import { ok } from "@/lib/cab/api";
import { bearerOf, revokeDriverToken } from "@/lib/cab/core";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = bearerOf(req);
  if (token) await revokeDriverToken(token);
  return ok();
}
