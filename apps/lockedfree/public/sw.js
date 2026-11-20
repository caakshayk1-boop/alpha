// Rulebook service worker (20 Nov 2026). Deliberately small: it makes the site installable and gives a clear offline page.
// Pages and data are ALWAYS fetched from the network first; nothing about the book, quotes or prices is ever served from a cache, so no stale figure can be passed off as current.
// No clients.claim() and no skipWaiting takeover of open pages: taking over mid-visit changed how the next navigation was handled (it lost its view transition), so the worker starts controlling pages from the next full load.
const CACHE = 'rb-offline-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/offline/'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET' || r.mode !== 'navigate') return;
  e.respondWith(fetch(r).catch(() => caches.open(CACHE).then((c) => c.match('/offline/')).then((m) => m || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } }))));
});
