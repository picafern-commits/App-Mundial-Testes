const CACHE_NAME = "mundial-pontos-2026-v349";
const APP_VERSION_SW_V298_USER_NOTIFICATIONS = "298.0";
let userNotificationsEnabledSwV298 = true;
const APP_VERSION_SW_V311_CLEAN_AUDIT = "311.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/apple-touch-icon-167.png",
  "./icons/apple-touch-icon-152.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => null))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then(clients => clients.forEach(client => client.postMessage({ type: "APP_VERSION_READY", cacheName: CACHE_NAME })))
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "USER_NOTIFICATIONS_STATE_V298") {
    userNotificationsEnabledSwV298 = event.data.enabled !== false;
  }
});

const NOTIFICATION_SEEN_CACHE_V297 = "mundial-push-seen-v297";
const NOTIFICATION_SEEN_TTL_V297 = 7 * 24 * 60 * 60 * 1000;

function notificationHashV297(text = "") {
  let hash = 0;
  const value = String(text || "");
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function notificationStableIdV297(payload = {}, title = "", body = "") {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const raw = data.notificationId || data.eventId || data.pushId || data.tag || data.collapseKey || payload.messageId || payload.fcmMessageId || notification.tag;
  if (raw) return `mundial-${String(raw).trim()}`;
  const type = data.type || "push";
  const gameId = data.gameId || data.matchId || data.chatMessageId || "";
  const stamp = data.createdAt || data.updatedAt || data.sentAt || "";
  return `mundial-${type}-${notificationHashV297(`${type}|${gameId}|${title}|${body}|${stamp}`)}`;
}

async function notificationSeenInSwV297(id) {
  if (!id) return false;
  try {
    const cache = await caches.open(NOTIFICATION_SEEN_CACHE_V297);
    const req = new Request(`https://local-notification-seen/${encodeURIComponent(id)}`);
    const hit = await cache.match(req);
    if (!hit) return false;
    const data = await hit.json().catch(() => ({}));
    const at = Number(data.at || 0);
    return at && Date.now() - at < NOTIFICATION_SEEN_TTL_V297;
  } catch {
    return false;
  }
}

async function markNotificationSeenInSwV297(id) {
  if (!id) return;
  try {
    const cache = await caches.open(NOTIFICATION_SEEN_CACHE_V297);
    const req = new Request(`https://local-notification-seen/${encodeURIComponent(id)}`);
    await cache.put(req, new Response(JSON.stringify({ id, at: Date.now() }), {
      headers: { "Content-Type": "application/json" }
    }));
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true }).catch(() => []);
    clients.forEach(client => client.postMessage({ type: "PUSH_SEEN_V297", id }));
  } catch {}
}

self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      payload = { notification: { title: "Mundial Pontos 2026", body: event.data?.text() || "" } };
    }

    if (userNotificationsEnabledSwV298 === false) return;

    const data = payload.data || {};
    const notification = payload.notification || {};
    const title = data.title || notification.title || "Mundial Pontos 2026";
    const body = data.body || notification.body || "";
    const stableId = notificationStableIdV297(payload, title, body);

    if (await notificationSeenInSwV297(stableId)) return;
    await markNotificationSeenInSwV297(stableId);

    const options = {
      body,
      tag: stableId,
      renotify: false,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: {
        url: data.url || "./index.html?open=notifications",
        type: data.type || "push",
        stableId
      }
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification?.data?.url || "./index.html?open=notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      const existing = clients.find(client => "focus" in client);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== location.origin) {
    return;
  }

  if (request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    }))
  );
});
