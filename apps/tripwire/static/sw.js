// Tripwire service worker. The shell is cached for offline use; data is network-first so a recent copy is never served as live,
// and falls back to the last copy (the page labels it by its own data date). Nothing user-written is ever sent or cached here.
const V = 'tw-__STAMP__';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/fonts/jetbrains-mono-latin-wght-normal.woff2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== 'tw-data').map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api/')) return;      // live prices are never cached or replayed by the worker
  if (u.pathname.startsWith('/data/')) {
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open('tw-data').then((x) => x.put(r, c)); } return res; }).catch(() => caches.match(r).then((m) => m || new Response('{"offline":true}', { status: 503, headers: { 'content-type': 'application/json' } }))));
    return;
  }
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('/'))); return; }
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok && /\.(js|css|png|svg)$/.test(u.pathname)) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); } return res; })));
});
