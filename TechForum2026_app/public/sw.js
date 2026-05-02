// TechForum 2026 — Service Worker (offline-first cache)
// Bumps automatically on every build via the hashed filename of the JS bundle.
const CACHE = 'techforum-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon-32x32.png',
  './icon-192.png',
  './icon-512.png',
  './app-icon-1024.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for /api/* (auth, data) — fallback to nothing (so Auth.tsx falls into local mode).
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;

  // Stale-while-revalidate for everything else (app shell, static assets).
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
