"use client";

// Browser side of Web Push for a traveller. `base` is the push endpoint
// (/api/cars/push). The service worker (public/sw.js) shows the notification.
export type PushState = "unsupported" | "unconfigured" | "denied" | "off" | "on";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
}

export async function getPushState(base: string): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const cfg = await (await fetch(base, { cache: "no-store" })).json();
    if (!cfg.enabled) return "unconfigured";
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enablePush(base: string): Promise<{ state: PushState; error?: string }> {
  if (!supported()) return { state: "unsupported" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { state: perm === "denied" ? "denied" : "off" };
  try {
    const cfg = await (await fetch(base, { cache: "no-store" })).json();
    if (!cfg.enabled || !cfg.publicKey) return { state: "unconfigured" };
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(cfg.publicKey) }));
    const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    const data = await res.json();
    if (!data.ok) return { state: "off", error: data.error };
    return { state: "on" };
  } catch (e) {
    return { state: "off", error: e instanceof Error ? e.message : "Could not turn on notifications." };
  }
}

export async function disablePush(base: string): Promise<PushState> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch(base, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
  } catch {}
  return "off";
}
