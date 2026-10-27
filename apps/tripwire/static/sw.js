// Tripwire service worker.
//  - The app shell (page, scripts, styles, fonts, icons) is precached at install, so the app opens with no network once it has been opened once.
//  - A new version WAITS. It takes over only when the page asks (message SKIP_WAITING), so a reload never lands in the middle of someone typing.
//  - /api/* (quotes, news, chart bars, health) is never cached and never replayed: no stale price can be handed back as current. A failed call is the page's to explain.
//  - /data/* (the published screen, signals, studies) is network-first, with the last good copy as the offline fallback. The page labels it by its own data date.
//  - Nothing the person wrote is here: notes, plans and trades live in localStorage and never reach the worker.
const V = 'tw-__STAMP__';
const DATA = 'tw-data';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', ...__ASSETS__];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await (await caches.open(V)).addAll(SHELL);
    try { await (await caches.open(DATA)).add('/data/screen.json'); } catch { /* the first screen is fetched by the page anyway */ }
  })());
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== DATA).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api/')) return;      // live prices, news and bars are never cached or replayed by the worker
  if (u.pathname.startsWith('/data/')) {
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(DATA).then((x) => x.put(r, c)); } return res; }).catch(() => caches.match(r).then((m) => m || new Response('{"offline":true}', { status: 503, headers: { 'content-type': 'application/json' } }))));
    return;
  }
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('/', { cacheName: V }).then((m) => m || Response.error()))); return; }
  e.respondWith(caches.match(r, { cacheName: V }).then((m) => m || fetch(r).then((res) => { if (res.ok && /\.(js|css|png|svg|woff2)$/.test(u.pathname)) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); } return res; })));
});
