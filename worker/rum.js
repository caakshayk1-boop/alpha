// rum.js — field speed measurements (Pro §31), with no identifiers.
//
// A sampled share of page loads sends one beacon when the page is hidden: the route TEMPLATE (never a symbol, query or
// hash), phone or desktop, and up to four Core Web Vitals. Nothing else: no address, no user agent, no cookie, no id. The
// Worker validates it and adds it to a per-day histogram in the Rum Durable Object; GET /api/rum reports the 75th
// percentile per route over the last 7 days, as the upper edge of its bucket ("at most"), with the sample size beside it.
//
// The histogram is all that is stored, so a single visit cannot be picked out of it.

export const METRICS = {
  lcp: { edges: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7000, 10000, 20000], max: 60000, good: 2500, poor: 4000 },
  inp: { edges: [50, 100, 150, 200, 300, 400, 500, 700, 1000, 2000], max: 30000, good: 200, poor: 500 },
  cls: { edges: [0.02, 0.05, 0.1, 0.15, 0.25, 0.4, 0.6, 1], max: 10, good: 0.1, poor: 0.25 },
  ttfb: { edges: [100, 200, 400, 600, 800, 1000, 1500, 2000, 3000, 5000], max: 60000, good: 800, poor: 1800 },
};
export const KEEP_DAYS = 8;
const MAX_ROUTES_PER_DAY = 60;      // a ceiling on distinct keys, so junk paths cannot grow storage without bound

/** The route template a path belongs to: "/", "/screen/", "/company/[slug]/". null for anything that is not a page path. */
export function routeOf(path) {
  if (typeof path !== 'string' || path.length > 80) return null;
  if (path === '/') return '/';
  if (/^\/company\/[^/]+\/$/.test(path)) return '/company/[slug]/';
  return /^\/[a-z][a-z-]{0,20}\/$/.test(path) ? path : null;
}

/** The checked beacon, or null. Unknown keys are dropped; out-of-range numbers drop that metric, never the beacon. */
export function validateBeacon(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const route = routeOf(b.r);
  if (!route) return null;
  const dev = b.d === 'phone' || b.d === 'desktop' ? b.d : null;
  if (!dev) return null;
  const m = {};
  for (const [k, spec] of Object.entries(METRICS)) {
    const v = b.m?.[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= spec.max) m[k] = v;
  }
  return Object.keys(m).length ? { route, dev, m } : null;
}

/** Index of the bucket a value falls in: the first edge it does not exceed, or one past the last edge. */
export const bucketOf = (metric, v) => { const e = METRICS[metric].edges; const i = e.findIndex((x) => v <= x); return i < 0 ? e.length : i; };

/** 75th percentile of a histogram, as the upper edge of its bucket (Infinity-free: the top bucket reports "over" its floor). */
export function p75(metric, counts) {
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n) return null;
  const want = Math.ceil(n * 0.75);
  let seen = 0;
  const e = METRICS[metric].edges;
  for (let i = 0; i < counts.length; i++) {
    seen += counts[i];
    if (seen >= want) return i < e.length ? { at_most: e[i], n } : { over: e[e.length - 1], n };
  }
  return null;
}

/** Add one beacon to a day's histograms (mutates and returns `day`). */
export function addTo(day, beacon) {
  for (const [k, v] of Object.entries(beacon.m)) {
    const key = `${beacon.route}|${beacon.dev}|${k}`;
    if (!day[key] && Object.keys(day).length >= MAX_ROUTES_PER_DAY * 8) continue;
    const counts = day[key] || Array(METRICS[k].edges.length + 1).fill(0);
    counts[bucketOf(k, v)]++;
    day[key] = counts;
  }
  return day;
}

/** Merge days into one report: { route: { phone|desktop: { metric: { at_most|over, n, rating } } } }. */
export function report(days) {
  const sum = {};
  for (const day of days) for (const [key, counts] of Object.entries(day || {})) {
    const s = sum[key] || Array(counts.length).fill(0);
    counts.forEach((c, i) => { s[i] += c; });
    sum[key] = s;
  }
  const out = {};
  for (const [key, counts] of Object.entries(sum)) {
    const [route, dev, metric] = key.split('|');
    const p = METRICS[metric] && p75(metric, counts);
    if (!p) continue;
    const v = p.at_most ?? Infinity;
    const rating = v <= METRICS[metric].good ? 'good' : v <= METRICS[metric].poor ? 'needs improvement' : 'poor';
    ((out[route] ||= {})[dev] ||= {})[metric] = { ...p, rating };
  }
  return out;
}

/** The store. One Durable Object for the deployment; one storage key per day. */
export class Rum {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const u = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    if (u.pathname === '/add') {
      const beacon = await request.json();
      const day = (await this.state.storage.get(today)) || {};
      await this.state.storage.put(today, addTo(day, beacon));
      const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
      const keys = await this.state.storage.list({ limit: 40 });
      for (const k of keys.keys()) if (k < cutoff) await this.state.storage.delete(k);
      return new Response('{"ok":true}');
    }
    const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const all = await this.state.storage.list({ limit: 40 });
    const days = [...all.entries()].filter(([k]) => k > since).map(([, v]) => v);
    return new Response(JSON.stringify({ ok: true, days: days.length, since, routes: report(days) }));
  }
}
