// sw.js — the offline shell (Pro §28). Deliberately small, and it never makes data look fresher than it is:
//   - pages: NETWORK FIRST. The last good copy of each visited page is kept for when the network is gone, and a page
//     served from that copy is one the reader already saw. With no copy, a plain "you are offline" page.
//   - /_next/static/*: cache first. These files are content-hashed and immutable, so a cached copy is always correct.
//   - data (/data, /api, /c, *.json): NEVER cached here. The app's own data layer keeps the last good figures and says
//     how old they are; a second, silent cache below it would undo that.
// A new deploy activates on the next load (skipWaiting + clients.claim); old caches are deleted on activate.
const SHELL = 'alpha-shell-v1';
const ASSETS = 'alpha-assets-v1';
const MAX_PAGES = 40;
const MAX_ASSETS = 200;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== ASSETS) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);      // oldest first
}

const OFFLINE = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · alpha</title>
<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#f5f3ee;color:#121528;display:grid;place-items:center;min-height:100vh;padding:16px}main{max-width:34rem}h1{font:500 32px/1.2 Georgia,serif;margin:0 0 8px}p{color:#474d63}a{color:#4b3bc8}@media (prefers-color-scheme:dark){body{background:#0d0f1a;color:#eceefa}p{color:#a6abc6}a{color:#b3a9ff}}</style></head>
<body><main><h1>You are offline.</h1><p>This page has not been opened on this device before, so there is no copy of it here. Pages you have opened before still work offline, showing the figures as they were when you last saw them.</p><p><a href="/">Try Today</a> · <a href="javascript:location.reload()">Retry</a></p></main></body></html>`;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(api|data|c)\//.test(url.pathname) || url.pathname.endsWith('.json') || url.pathname === '/sw.js') return;

  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith((async () => {
      const c = await caches.open(ASSETS);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { c.put(req, res.clone()); trim(ASSETS, MAX_ASSETS); }
      return res;
    })());
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') { c.put(url.pathname, res.clone()); trim(SHELL, MAX_PAGES); }
        return res;
      } catch {
        return (await c.match(url.pathname)) || new Response(OFFLINE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
    })());
  }
});
