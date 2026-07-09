// TechForum 2026 — Service Worker SELF-DESTRUCT
// Старый SW из предыдущих APK мог режать fetch к http://72.56.9.90:3100.
// Эта версия НИЧЕГО не кеширует и при активации удаляет все caches и
// сама себя unregister'ит — после первой загрузки клиент чист.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    } catch (_) {}
    try { await self.registration.unregister(); } catch (_) {}
    try {
      const clients = await self.clients.matchAll();
      for (const c of clients) { try { c.navigate(c.url); } catch (_) {} }
    } catch (_) {}
  })());
});
self.addEventListener('fetch', () => { /* no interception */ });
