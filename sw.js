const CACHE_NAME = "mundial-pontos-2026-v112";
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

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCOyW5rfwF8iZxcVN6jxR4VqZ6pNdNmFRA",
  authDomain: "app-mundial2026.firebaseapp.com",
  projectId: "app-mundial2026",
  storageBucket: "app-mundial2026.firebasestorage.app",
  messagingSenderId: "143980254410",
  appId: "1:143980254410:web:0f48873c3aa4c9ad201033"
};

try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    const title = notification.title || data.title || "Mundial Pontos 2026";
    const body = notification.body || data.body || "Tens uma nova notificacao.";
    const room = data.room || "general";
    const type = data.type || "";
    const url = data.url || `./index.html?open=chat&room=${encodeURIComponent(room)}&notif=${encodeURIComponent(type)}`;

    self.registration.showNotification(title, {
      body,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: data.tag || `mundial-${type || "notificacao"}-${data.id || Date.now()}`,
      data: { url, room, type, id: data.id || "" },
      renotify: true
    });
  });
} catch (error) {
  console.warn("Firebase Messaging nao iniciou no service worker:", error);
}

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
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./index.html", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "OPEN_NOTIFICATION_TARGET", url: targetUrl, data: event.notification.data || {} });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
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
