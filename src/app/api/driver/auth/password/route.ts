import { z } from "zod";
import { fail, ok, readJson } from "@/lib/cab/api";
import { bearerOf, changeDriverPassword, driverFromRequest } from "@/lib/cab/core";

export const runtime = "nodejs";

const schema = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: z.string().min(8, "New password must be at least 8 characters").max(100, "Password is too long"),
});

// The signed-in driver changes their own password (also how they replace the
// temporary one an admin gave them after a reset).
export async function POST(req: Request) {
  const driver = await driverFromRequest(req);
  if (!driver) return fail("Please sign in again.", 401);

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the passwords.");
  if (parsed.data.current === parsed.data.next) return fail("Choose a different password from the current one.");

  const res = await changeDriverPassword(driver.id, parsed.data.current, parsed.data.next, bearerOf(req));
  return res.ok ? ok() : fail(res.error, 403);
}
