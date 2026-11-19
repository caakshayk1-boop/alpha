// Market data routes for the hub (19 Nov 2026): /v1/market/tick, /pulse, /macro and /chart.
// PORTED VERBATIM from apps/tripwire/worker.js (parseIntraday, parseSpark, sparkMany, parseChart, chartOne, the limiter and the coalescer), so every response has Tripwire's exact shape and ApexPro can switch hosts without an adapter. tests/market-parity.test.mjs runs both copies over the same fixtures and fails if they drift.
// All upstream data is Yahoo Finance, delayed and unofficial; no secrets, no storage. Limits are best-effort (the edge cache), the same as Tripwire's.
const SYM = /^[A-Z0-9&-]{1,20}$/;
const MAX_RAW_LIST = 1400;
// Macro instruments, by the name the app uses. Yahoo's symbols: COMEX futures for gold, silver, WTI; ICE for Brent; spot FX; Bitcoin in dollars.
export const MACRO = { GOLD: 'GC=F', SILVER: 'SI=F', BRENT: 'BZ=F', WTI: 'CL=F', USDINR: 'INR=X', MYRINR: 'MYRINR=X', USDMYR: 'MYR=X', BTC: 'BTC-USD' };
export const SECURITY = { 'strict-transport-security': 'max-age=31536000; includeSubDomains', 'cross-origin-opener-policy': 'same-origin' };
const H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60, s-maxage=300', 'x-content-type-options': 'nosniff', ...SECURITY };
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...H, ...extra } });
const r2 = (x) => Math.round(x * 100) / 100;
const LIMITS = { quote: [90, 60], history: [40, 60] };
const isLocalHost = (url) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
const istParts = (ms) => { const d = new Date(ms + 330 * 60000); return { day: d.toISOString().slice(0, 10), mins: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
export function normSymbols(raw, max, min = 1) {
  const text = String(raw ?? ''); if (text.length > MAX_RAW_LIST) return null;
  const list = [...new Set(text.toUpperCase().split(',').map((x) => x.trim()).filter(Boolean))].sort();
  if (list.length < min || list.length > max || !list.every((s) => SYM.test(s))) return null; return list;
}
/** Best-effort per-client limiter: a counter per class, client address and window, kept in the edge cache of the data centre that served the request (the same mechanism as "Refresh now").
 *  Returns 0 when the call may go on, or the seconds to wait. Local development (no client address, or a localhost URL) is never limited. */
export async function overLimit(request, cls, nowMs = Date.now()) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const lim = LIMITS[cls]; if (!cache || !lim) return 0;
  const ip = request.headers.get('cf-connecting-ip'); if (!ip || isLocalHost(new URL(request.url))) return 0;
  const [max, win] = lim; const slot = Math.floor(nowMs / (win * 1000)); const left = Math.max(1, Math.ceil(((slot + 1) * win * 1000 - nowMs) / 1000));
  const key = new Request(`https://alpha.internal/__rl_v1/${cls}/${encodeURIComponent(ip)}/${slot}`);
  try {
    const hit = await cache.match(key); const n = hit ? Number(await hit.text()) || 0 : 0; if (n >= max) return left;
    await cache.put(key, new Response(String(n + 1), { headers: { 'cache-control': `max-age=${left + 1}` } }));
  } catch { /* the counter is unavailable: fail open, this is not a security control */ }
  return 0;
}
/** The 429 every limited route answers: JSON, Retry-After, never cached, and the same security headers as every other response. */
export const slowDown = (retryAfter) => json({ ok: false, error: 'too many requests', retryAfter }, 429, { 'retry-after': String(retryAfter), 'cache-control': 'no-store' });

/** Request coalescing within one isolate: concurrent callers that need the same upstream answer share ONE fetch. The shared value must be plain data. */
const INFLIGHT = new Map();
export function coalesce(key, fn) {
  let p = INFLIGHT.get(key);
  if (!p) { p = Promise.resolve().then(fn).finally(() => { if (INFLIGHT.get(key) === p) INFLIGHT.delete(key); }); INFLIGHT.set(key, p); }
  return p;
}
/** coalesce() for a handler that answers with a Response: each caller gets its own copy. */
async function coalesceResponse(key, fn) {
  const s = await coalesce(key, async () => { const r = await fn(); return { status: r.status, headers: [...r.headers], body: await r.text() }; });
  return new Response(s.body, { status: s.status, headers: s.headers });
}

/** Pure: one session of five-minute closes plus the live price and the previous close. `live` is true when the last print is under 25
 *  minutes old, which is how the app knows the market is trading without a holiday calendar. */
export function parseIntraday(res, nowMs = Date.now()) {
  const ts = res?.timestamp, cl = res?.indicators?.quote?.[0]?.close, m = res?.meta;
  if (!Array.isArray(ts) || !Array.isArray(cl)) return null;
  const t = [], c = [];
  ts.forEach((x, i) => { if (cl[i] > 0) { t.push(x); c.push(r2(cl[i])); } });
  const px = Number(m?.regularMarketPrice) > 0 ? r2(Number(m.regularMarketPrice)) : c[c.length - 1];
  const pt = Number(m?.regularMarketTime) || t[t.length - 1];
  const prev = Number(m?.chartPreviousClose ?? m?.previousClose);
  // no valid bar yet but the exchange's own last trade is from today: that print is the quote (a stock whose first trade has not landed in a five-minute bucket)
  if (!t.length && px > 0 && pt && new Date((pt + 19800) * 1000).toISOString().slice(0, 10) === new Date(nowMs + 19800000).toISOString().slice(0, 10)) { t.push(pt); c.push(px); }
  if (!(px > 0) || !(prev > 0) || t.length < 1) return null;
  return { t, c, px, pt, prev: r2(prev), live: nowMs / 1000 - pt < 25 * 60 };
}
const fetchIntraday = (yahooSymbol, cache, ctx) => coalesce('intra:' + yahooSymbol, () => fetchIntradayOne(yahooSymbol, cache, ctx));
async function fetchIntradayOne(yahooSymbol, cache, ctx) {
  const key = new Request(`https://alpha.internal/__intra_v2/${yahooSymbol}`);
  const hit = cache && await cache.match(key); if (hit) return hit.json();
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=5m`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) return null;
  const p = parseIntraday((await r.json())?.chart?.result?.[0]); if (!p) return null;
  if (cache && ctx) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=6' } })));
  return p;
}
/** Pure: one symbol's entry from Yahoo's spark endpoint (twenty symbols a call) in the same shape as `parseIntraday`. */
export function parseSpark(e, nowMs = Date.now()) {
  const ts = e?.timestamp, cl = e?.close; if (!Array.isArray(ts) || !Array.isArray(cl)) return null;
  const t = [], c = []; ts.forEach((x, i) => { if (cl[i] > 0) { t.push(x); c.push(r2(cl[i])); } });
  const prev = Number(e.chartPreviousClose ?? e.previousClose); const px = c[c.length - 1]; const pt = t[t.length - 1];
  if (!(px > 0) || !(prev > 0) || t.length < 1) return null;   // ONE valid bar is a real quote: a thin stock has empty five-minute buckets, and in the first minutes it may have traded once (it was dropped as 'missing' before, and shown at yesterday's close)
  return { t, c, px, pt, prev: r2(prev), live: nowMs / 1000 - pt < 25 * 60 };
}
const SPARK = 20;
const RETRY_MAX = 8;
/** Monday to Friday, 09:15 to 15:30 on the Indian clock. Exchange holidays are not modelled here (the app's calendar is); on one, every name is missing and the bounded retry finds nothing, which is harmless. */
export function marketOpenNow(nowMs = Date.now()) { const d = new Date(nowMs + 19800000); const wd = d.getUTCDay(); const m = d.getUTCHours() * 60 + d.getUTCMinutes(); return wd >= 1 && wd <= 5 && m >= 9 * 60 + 15 && m <= 15 * 60 + 30; }
/** The probe that says whether the FEED is current: the Nifty's newest print. Added to every quote request (unless the caller already asked for the Nifty) and reported as feed_t. */
const FEED_PROBE = ['__feed', '^NSEI'];
/** Live quotes for many symbols with few requests: Yahoo's spark endpoint takes twenty at a time, and each batch is cached for six seconds so
 *  every open copy of the app shares it. A batch that fails falls back to one request per symbol. `pairs` is [[ourKey, yahooSymbol], ...]. */
export async function sparkMany(pairs, ctx, nowMs = Date.now()) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const out = {}; const missing = [];
  const sorted = [...pairs].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));          // one order for every caller, so the same set is the same cache entry
  const chunks = []; for (let i = 0; i < sorted.length; i += SPARK) chunks.push(sorted.slice(i, i + SPARK));
  await Promise.all(chunks.map(async (ch) => {
    const key = new Request(`https://alpha.internal/__spark_v1/${ch.map((p) => p[1]).sort().join(',')}`);
    try {
      const body = await coalesce(key.url, async () => {
        const hit = cache && await cache.match(key); if (hit) return hit.json();
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(ch.map((p) => p[1]).join(','))}&range=1d&interval=5m`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
        if (!r.ok) throw new Error('spark ' + r.status); const b = await r.json();
        if (cache && ctx) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=6' } })));
        return b;
      });
      for (const [k, y] of ch) { const p = parseSpark(body?.[y]); if (p) out[k] = p; else missing.push(k); }
    } catch {
      await Promise.all(ch.map(async ([k, y]) => { try { const p = await fetchIntraday(y, cache, ctx); if (p) out[k] = p; else missing.push(k); } catch { missing.push(k); } }));
    }
  }));
  // A name the batch feed left out while the market is open (a thin stock in the opening minutes, a batch that skipped it) is asked for on its own, through the single-symbol endpoint, before it is given up.
  // Bounded: at most RETRY_MAX names per request. A name that still has no bars today has not traded yet, and stays missing (the app says so).
  if (missing.length && marketOpenNow(nowMs)) {
    const yOf = new Map(pairs); const again = missing.splice(0, missing.length); const left = [];
    await Promise.all(again.slice(0, RETRY_MAX).map(async (k) => { try { const p = await fetchIntraday(yOf.get(k), cache, ctx); if (p && p.t.length) out[k] = p; else left.push(k); } catch { left.push(k); } }));
    missing.push(...left, ...again.slice(RETRY_MAX));
  }
  return { out, missing };
}

const INDICES = { NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', VIX: '^INDIAVIX' };
const LIVE_H = { 'cache-control': 'public, max-age=4, s-maxage=6' };
async function quotes(list, map, ctx) {
  const { out, missing } = await sparkMany([...list.map((s) => [s, map(s)]), FEED_PROBE], ctx);
  const feed_t = out.__feed?.pt ?? null; delete out.__feed;
  return json({ ok: Object.keys(out).length > 0, fetched_at: new Date().toISOString(), feed_t, quotes: out, missing: missing.filter((k) => k !== '__feed') }, 200, LIVE_H);
}
const TICK_MAX = 60;
async function tick(url, ctx) {
  const list = normSymbols(url.searchParams.get('s'), TICK_MAX, 0);
  if (!list) return json({ ok: false, error: `give up to ${TICK_MAX} valid symbols` }, 400);
  const wantI = url.searchParams.get('i') === '1', wantM = url.searchParams.get('m') === '1';
  const pairs = [...list.map((s) => ['s:' + s, `${s}.NS`]), ...(wantI ? Object.entries(INDICES).map(([k, y]) => ['i:' + k, y]) : []), ...(wantM ? Object.entries(MACRO).map(([k, y]) => ['m:' + k, y]) : [])];
  if (!wantI) pairs.push(FEED_PROBE);
  const { out, missing } = await sparkMany(pairs, ctx); const feed_t = (out.__feed ?? out['i:NIFTY'])?.pt ?? null; delete out.__feed; const pick = (pre) => Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith(pre)).map(([k, v]) => [k.slice(2), v]));
  const body = { ok: Object.keys(out).length > 0, fetched_at: new Date().toISOString(), feed_t, quotes: pick('s:'), missing: missing.filter((k) => k !== '__feed').map((k) => k.slice(2)) }; if (wantI) body.pulse = pick('i:'); if (wantM) body.macro = pick('m:');
  return json(body, 200, LIVE_H);
}

/** Pure: Yahoo's long daily history reduced to epoch seconds, closes and, where Yahoo prints them, the day's open, high, low and volume.
 *  A day missing its close is dropped, never filled. A day missing an open, high, low or volume keeps the close and has null for the rest (never the close in their place). */
export function parseChart(res, niftyRes) {
  const ts = res?.timestamp; const q = res?.indicators?.quote?.[0]; const cl = q?.close;
  if (!Array.isArray(ts) || !Array.isArray(cl)) return null;
  const t = [], c = [], o = [], h = [], l = [], v = [];
  const pos = (x) => (x > 0 ? Math.round(x * 100) / 100 : null);
  ts.forEach((x, i) => { if (cl[i] > 0 && x > 0) { t.push(x); c.push(Math.round(cl[i] * 100) / 100); o.push(pos(q.open?.[i])); h.push(pos(q.high?.[i])); l.push(pos(q.low?.[i])); v.push(q.volume?.[i] >= 0 && Number.isFinite(q.volume[i]) ? Math.round(q.volume[i]) : null); } });
  if (t.length < 30) return null;
  // the Nifty close on the same Indian calendar day; null where the index has no figure (never filled from another day)
  const day = (x) => Math.floor((x + 19800) / 86400); const nm = new Map();
  const nt = niftyRes?.timestamp, nc = niftyRes?.indicators?.quote?.[0]?.close;
  if (Array.isArray(nt) && Array.isArray(nc)) nt.forEach((x, i) => { if (nc[i] > 0) nm.set(day(x), Math.round(nc[i] * 100) / 100); });
  const n = t.map((x) => (nm.has(day(x)) ? nm.get(day(x)) : null));
  const some = (a) => a.some((x) => x !== null);
  return { t, c, n: n.some((x) => x !== null) ? n : null, o: some(o) ? o : null, h: some(h) ? h : null, l: some(l) ? l : null, v: some(v) ? v : null };
}
// GET /api/chart?s=TCS  ->  { ok, sym, t:[epoch s], c:[close] } : every daily close Yahoo holds (up to the whole listing), split-adjusted, dividends not included, with the Nifty 50 close of the same day in `n` (null where absent; the whole field is null if the index could not be read).
// The page makes its own ranges and its monthly view from this one series. Cached six hours: a close does not change after the session.
// An explicit date range, never `range=max`: for a long history Yahoo answers `range=max&interval=1d` with MONTHLY bars (TCS came back as 267 monthly bars from 2002), and daily and weekly candles cannot be built from months.
const FROM = 631152000;   // 1 Jan 1990, before any NSE listing; Yahoo starts at the first trade
async function chart(url, ctx) {
  const sym = (url.searchParams.get('s') || '').toUpperCase().trim();
  if (!SYM.test(sym)) return json({ ok: false, error: 'bad symbol' }, 400);
  return coalesceResponse('chart:' + sym, () => chartOne(sym, ctx));
}
async function chartOne(sym, ctx) {
  const macro = Object.prototype.hasOwnProperty.call(MACRO, sym);          // an instrument, not an NSE share: its own Yahoo symbol, and no Nifty line
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(`https://alpha.internal/__chart_v3/${sym}`);
  try {
    const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { status: hit.status, headers: { ...H, 'cache-control': hit.status === 200 ? 'public, max-age=1800, s-maxage=21600' : 'public, max-age=60, s-maxage=600' } });
    const get = (s) => fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?period1=${FROM}&period2=${Math.floor(Date.now() / 1000) + 86400}&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    const [r, nr] = await Promise.all([get(macro ? MACRO[sym] : `${sym}.NS`), macro ? Promise.resolve(null) : get('^NSEI').catch(() => null)]);
    if (r.status === 404) {          // an unknown symbol is remembered for ten minutes, so a bad client cannot make one Yahoo call per request
      const miss = json({ ok: false, error: 'no price history for this symbol' }, 404, { 'cache-control': 'public, max-age=60, s-maxage=600' }); if (cache && ctx) ctx.waitUntil(cache.put(key, miss.clone())); return miss;
    }
    if (!r.ok) return json({ ok: false, error: 'the price source did not answer' }, 502);
    const niftyRes = nr && nr.ok ? (await nr.json().catch(() => null))?.chart?.result?.[0] : null;
    const p = parseChart((await r.json())?.chart?.result?.[0], niftyRes);
    if (!p) return json({ ok: false, error: 'too little history' }, 404);
    const res = json({ ok: true, sym, ...p }, 200, { 'cache-control': 'public, max-age=1800, s-maxage=21600' });
    if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch { return json({ ok: false, error: 'the price source did not answer' }, 502); }
}


const ROUTES = { '/v1/market/tick': ['quote', (url, ctx) => tick(url, ctx)], '/v1/market/pulse': ['quote', (url, ctx) => quotes(Object.keys(INDICES), (k) => INDICES[k], ctx)], '/v1/market/macro': ['quote', (url, ctx) => quotes(Object.keys(MACRO), (k) => MACRO[k], ctx)], '/v1/market/chart': ['history', (url, ctx) => chart(url, ctx)] };
/** The hub's market routes. Returns null for any other path, so the caller carries on. GET only. */
export async function marketRoute(request, url, ctx) {
  const route = ROUTES[url.pathname.replace(/\/$/, '')]; if (!route) return null;
  if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
  if (url.search.length > 2000) return json({ ok: false, error: 'request too long' }, 414, { 'cache-control': 'no-store' });
  const wait = await overLimit(request, route[0]); if (wait) return slowDown(wait);
  return route[1](url, ctx);
}
