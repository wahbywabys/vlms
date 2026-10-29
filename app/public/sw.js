/*
 * VTC_LMS service worker: keeps the floor tablet and apprentice phone usable
 * when the workshop Wi-Fi or site signal drops.
 *
 *  - /_next/static, fonts, logos: cache-first (content-hashed, safe forever)
 *  - pages: network-first, falling back to the last copy of that page
 *  - /api: never cached; writes made offline go to the IndexedDB outbox in
 *    the page and are replayed through /api/v1/sync when back online
 */
const STATIC = 'vtc-static-v1', PAGES = 'vtc-pages-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![STATIC, PAGES].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;
  const isStatic = url.pathname.startsWith('/_next/static/') || /\.(svg|png|woff2?)$/.test(url.pathname) || url.host.includes('fonts.g');
  if (isStatic) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) ?? fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; })));
    return;
  }
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(PAGES);
      try {
        const r = await fetch(req);
        if (r.ok && !r.redirected) c.put(req, r.clone());
        return r;
      } catch {
        return (await c.match(req)) ?? (await c.match('/')) ?? new Response('<h1>Offline</h1><p>Reconnect to load this page.</p>', { headers: { 'content-type': 'text/html' } });
      }
    })());
  }
});

// Background Sync (Chromium): ask an open page to flush its outbox.
self.addEventListener('sync', (e) => {
  if (e.tag === 'vtc-outbox') e.waitUntil(self.clients.matchAll().then((cs) => cs.forEach((c) => c.postMessage({ type: 'flush-outbox' }))));
});
