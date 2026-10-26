import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureConsentsTable } from "@/lib/db/ensure-consents";
import { CURRENT_VERSION, type ConsentKind } from "@/lib/legal";

// Server-only helpers. Deliberately NOT a "use server" file: these take a
// user id, so they must never be callable from the browser as server actions.

export interface ConsentState {
  granted: boolean;
  version: string;
  at: Date;
}

export async function recordConsents(userId: string, items: { kind: ConsentKind; granted: boolean }[]): Promise<void> {
  await ensureConsentsTable();
  for (const it of items) {
    await db.execute(
      sql`INSERT INTO user_consents (id, user_id, kind, version, granted) VALUES (${randomUUID()}, ${userId}, ${it.kind}, ${CURRENT_VERSION[it.kind]}, ${it.granted})`
    );
  }
}

export async function latestConsents(userId: string): Promise<Partial<Record<ConsentKind, ConsentState>>> {
  await ensureConsentsTable();
  const res = await db.execute(
    sql`SELECT DISTINCT ON (kind) kind, version, granted, created_at FROM user_consents WHERE user_id = ${userId} ORDER BY kind, created_at DESC`
  );
  const rows = ((res as unknown as { rows?: unknown[] }).rows ?? (res as unknown as unknown[])) as {
    kind: ConsentKind;
    version: string;
    granted: boolean;
    created_at: string | Date;
  }[];
  const out: Partial<Record<ConsentKind, ConsentState>> = {};
  for (const r of rows) out[r.kind] = { granted: r.granted, version: r.version, at: new Date(r.created_at) };
  return out;
}

/** True when the user has a current, granted agreement to both the Privacy Policy and the Terms. */
export function hasRequiredConsents(c: Partial<Record<ConsentKind, ConsentState>>): boolean {
  return (["privacy", "terms"] as const).every((k) => {
    const s = c[k];
    return !!s && s.granted && s.version === CURRENT_VERSION[k];
  });
}
