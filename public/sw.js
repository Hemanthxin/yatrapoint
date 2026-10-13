// Deliberately minimal service worker — exists only to make the site
// installable (PWA / TWA), NOT to add offline behaviour. It only ever caches
// a small fixed set of public, non-personalised static assets (the manifest
// + icons). Every other request — every page, every API call — is left
// completely untouched and goes straight to the network.
//
// This app renders per-user, signed-in content via NextAuth session cookies.
// A service worker that cached HTML/API responses could serve one user's
// cached page to another (or a signed-out visitor a signed-in page), so this
// worker intentionally never touches navigation or data requests.
const CACHE_NAME = "saafera-static-v1";
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!PRECACHE_URLS.includes(url.pathname)) return; // everything else: untouched, straight to network

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// ── Push notifications (car bookings) ───────────────────────────────────────
// Only shows a notification and tells any open Saafera tab to refresh; it never
// caches or touches page/API requests (see the note at the top of this file).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Saafera", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Saafera", {
        body: data.body || "",
        tag: data.tag || undefined,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: data.url || "/cars/bookings" },
        vibrate: [200, 100, 200],
      }),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "saafera-push" }));
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/cars/bookings";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
