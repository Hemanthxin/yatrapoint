// Web Push for the cab marketplace. A driver (Saafera Captain app) or a traveller
// (Saafera site) subscribes once per device; the server then pushes a notification
// the moment something happens — even when the app or browser tab is closed.
//
// Needs VAPID keys in the environment (generate once with
// `npx web-push generate-vapid-keys`):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: contact)
// Without them every function here quietly does nothing, and the apps fall back to
// polling, so a missing key never breaks a booking.
import webpush from "web-push";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { createId } from "@/lib/utils/id";
import { ensureCabTables } from "@/lib/db/ensure-cabs";

export type PushOwner = "driver" | "user";

export interface PushPayload {
  title: string;
  body: string;
  /** where tapping the notification goes (a path on the receiving app) */
  url?: string;
  /** a newer notification with the same tag replaces the older one */
  tag?: string;
}

export const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

let configured = false;
function configure(): boolean {
  if (!pushEnabled()) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@saafera.in", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return true;
}

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function isBrowserSubscription(x: unknown): x is BrowserSubscription {
  const s = x as BrowserSubscription | null;
  return !!s && typeof s.endpoint === "string" && s.endpoint.startsWith("https://") && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";
}

export async function savePushSubscription(owner: PushOwner, ownerId: string, sub: BrowserSubscription): Promise<void> {
  await ensureCabTables();
  // The same browser may switch accounts, so the endpoint is the key and the owner follows it.
  await db.execute(sql`INSERT INTO cab_push_subscriptions (id, owner_type, owner_id, endpoint, p256dh, auth)
    VALUES (${createId()}, ${owner}, ${ownerId}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET owner_type = ${owner}, owner_id = ${ownerId}, p256dh = ${sub.keys.p256dh}, auth = ${sub.keys.auth}`);
}

export async function removePushSubscription(owner: PushOwner, ownerId: string, endpoint: string): Promise<void> {
  await ensureCabTables();
  await db.execute(sql`DELETE FROM cab_push_subscriptions WHERE endpoint = ${endpoint} AND owner_type = ${owner} AND owner_id = ${ownerId}`);
}

/** Pushes to every device the owner has subscribed. Best-effort: never throws. */
export async function sendPush(owner: PushOwner, ownerId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!configure()) return { sent: 0, failed: 0 };
  try {
    await ensureCabTables();
    const res = await db.execute(sql`SELECT endpoint, p256dh, auth FROM cab_push_subscriptions WHERE owner_type = ${owner} AND owner_id = ${ownerId}`);
    const subs = ((res as { rows?: unknown[] }).rows ?? res) as Array<{ endpoint: string; p256dh: string; auth: string }>;
    if (subs.length === 0) return { sent: 0, failed: 0 };

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60, urgency: "high", timeout: 5000 })),
    );

    // 404/410 mean the browser revoked the subscription — drop it so we stop trying.
    const gone: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) gone.push(subs[i].endpoint);
      }
    });
    for (const endpoint of gone) await db.execute(sql`DELETE FROM cab_push_subscriptions WHERE endpoint = ${endpoint}`);

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return { sent, failed: results.length - sent };
  } catch {
    return { sent: 0, failed: 0 };
  }
}
