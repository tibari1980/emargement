// Service Worker PWA Offline-First — ESRP / CFRP Valentin Haüy
// Plateforme d'Émargement & Pédagogie Accessible RGAA 4.1 AAA

const CACHE_NAME = "avh-emargement-pwa-v1";

const PRECACHE_ASSETS = [
  "/",
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-32x32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/images/logo-valentin-hauy.png",
  "/images/autonomie-guide-dog.jpg",
];

// Installation : pré-mise en cache des assets essentiels
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[SW] Pre-cache non-blocking warning:", err);
        });
      })
      .then(() => self.skipWaiting()),
  );
});

// Activation : purge des anciennes versions de caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith("avh-emargement-") && name !== CACHE_NAME)
            .map((name) => {
              console.info("[SW] Removing outdated cache:", name);
              return caches.delete(name);
            }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Interception des requêtes réseau
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== "GET") return;

  // Ignorer les requêtes API et Firebase (doivent être traitées en temps réel ou gérées par l'IndexedDB)
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("identitytoolkit")
  ) {
    return;
  }

  // 1. Assets statiques (JS, CSS, Polices, Images) : Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2|woff|ttf|css|js)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }

  // 2. Pages de navigation (HTML) : Network-First avec repli Cache pour mode hors-ligne
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          console.info("[SW] Network unreachable, serving cached page for:", url.pathname);
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("/");
          return fallback || new Response("Mode hors-ligne CFRP Valentin Haüy", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }),
    );
  }
});

