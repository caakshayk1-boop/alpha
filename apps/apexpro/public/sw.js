const VERSION = 'apexpro-v13-terminal';
const SHELL = ["/","/index.html","/tokens.css","/app.css","/app.js","/reel.js","/share-card.js","/vendor/motion.js","/vendor/gsap.min.js","/fonts/geist-var.woff2","/fonts/fraunces.woff2","/fonts/fraunces-ext.woff2","/icons.svg","/icon.svg","/icon-192.png","/icon-512.png","/mono.woff2","/manifest.webmanifest","/shared-Z4D75UNL.js"];
self.addEventListener('install', event => { event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('apexpro-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const response = await fetch(event.request);
      if (response.ok) { event.waitUntil(cache.put(event.request, response.clone()).then(async () => { const keys = await cache.keys(); const data = keys.filter(k => new URL(k.url).pathname.startsWith('/api/')); if (data.length > 80) await cache.delete(data[0]); })); return response; }
      if (!url.pathname.startsWith('/api/')) return response;
      throw new Error('Data unavailable');
    } catch {
      const cached = await cache.match(event.request);
      if (cached) { const out = new Response(cached.body, cached); if (url.pathname.startsWith('/api/')) out.headers.set('x-apex-offline', '1'); return out; }
      if (event.request.mode === 'navigate') return (await cache.match('/')) || new Response('Reconnect to open ApexPro.', { status: 503 });
      return new Response(JSON.stringify({ error: 'Offline and no saved response' }), { status: 503, headers: { 'content-type': 'application/json' } });
    }
  })());
});
