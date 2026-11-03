// Tripwire Worker: static assets plus read-only routes: /api/bars and /api/intraday (paper tracker, live P&L, list quotes), /api/tick (everything on screen in one request, every 8 s), /api/breadth (live trend map), /api/pulse (index strip), /api/macro (gold, silver, oil, FX, Bitcoin), /api/news and /api/news/version (the published news snapshot, and live queries for one name, through one pipeline), /api/chart (price history), /api/ledger (forward record), /api/factors (nightly factor sheet).
//   GET /api/bars?s=TCS,INFY   (up to 30 NSE symbols)
//   -> { ok, fetched_at, bars: { TCS: { t:[epoch s], o:[], h:[], l:[], c:[], forming: bool, live: { px, t } | null } }, missing: [] }
// Daily bars for six months from Yahoo Finance. A bar missing any of open, high, low or close is dropped, never filled. The last bar
// is marked `forming` while its session is still open (IST), so the tracker never treats it as a close. Cached five minutes per
// symbol. No secrets, no storage, no user data: the request carries only symbols.
import { runPipeline, compactEvent } from './news/pipeline.js';
import { buildRegistry } from './news/entities.js';
import { parseFeed } from './news/feed.js';
import { FEEDS, QUERY_SCHEMA } from './news/config.js';
import { ALIASES } from './news/aliases.js';
import { catchupDecision, runCatchup } from './news/catchup.js';
import { nudge } from './news/nudge.js';
import { inBreadth, MIN_SECTOR } from './shared/breadthrule.js';
const SYM = /^[A-Z0-9&-]{1,20}$/;
const MAX = 30;                              // symbols a call may ask for (list quotes, the paper books): one Yahoo call each, cached 60 s (quotes) or 5 min (bars)
const MAX_QUOTES = MAX;
// Macro instruments, by the name the app uses. Yahoo's symbols: COMEX futures for gold, silver, WTI; ICE for Brent; spot FX; Bitcoin in dollars.
export const MACRO = { GOLD: 'GC=F', SILVER: 'SI=F', BRENT: 'BZ=F', WTI: 'CL=F', USDINR: 'INR=X', MYRINR: 'MYRINR=X', USDMYR: 'MYR=X', BTC: 'BTC-USD' };
// Security headers every response from this Worker carries. Static assets get the same two from static/_headers; the /data/* passthrough below sets them itself, so no path is without them.
export const SECURITY = { 'strict-transport-security': 'max-age=31536000; includeSubDomains', 'cross-origin-opener-policy': 'same-origin' };
const H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60, s-maxage=300', 'x-content-type-options': 'nosniff', ...SECURITY };
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...H, ...extra } });
const r2 = (x) => Math.round(x * 100) / 100;

// ---- Shared limits, input caps and coalescing (docs/tripwire/beta/WORKER_LIMITS.md) ---------------------------------------------------
// Every limiter and cache here lives in the data centre's edge cache (the Cache API): no binding, no storage, no paid service. A limit is BEST-EFFORT: each data centre counts its own
// clients, a count can be missed under a burst, and nothing here is a security control. The platform-level rule (a Cloudflare dashboard step) is the real ceiling; see the doc.
/** Per-client allowances, [requests, window in seconds]. Set well above what a person does (the Today poll is one /api/tick every 8 s, about 8 a minute; a compare of three names is three chart reads). */
export const LIMITS = { quote: [90, 60], history: [40, 60], news: [20, 60], file: [60, 60], health: [20, 60] };
/** The route -> allowance class table. A route that calls an upstream is listed here or it is not served. */
export const ROUTE_CLASS = { '/api/tick': 'quote', '/api/intraday': 'quote', '/api/pulse': 'quote', '/api/macro': 'quote', '/api/breadth': 'quote', '/api/news/catchup': 'quote',
  '/api/chart': 'history', '/api/bars': 'history', '/api/news': 'news', '/api/news/version': 'file', '/api/ledger': 'file', '/api/factors': 'file', '/api/rsi': 'file', '/api/health': 'health' };
const MAX_RAW_LIST = 1400;           // characters of a symbol list: sixty 20-character symbols and their commas, so a hundred-thousand-comma list is refused before it is split
const MAX_SEARCH = 2000;             // characters of any /api query string
/** Pure. A symbol list from its raw query value: upper-cased, trimmed, de-duplicated and SORTED (so `B,A` and `A,B` are one cache entry). null when it is too long, too many, or any symbol is not
 *  1 to 20 of A-Z 0-9 & -. `min` 0 allows an empty list. */
export function normSymbols(raw, max, min = 1) {
  const text = String(raw ?? ''); if (text.length > MAX_RAW_LIST) return null;
  const list = [...new Set(text.toUpperCase().split(',').map((x) => x.trim()).filter(Boolean))].sort();
  if (list.length < min || list.length > max || !list.every((s) => SYM.test(s))) return null; return list;
}
const isLocal = (url) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
/** Best-effort per-client limiter: a counter per class, client address and window, kept in the edge cache of the data centre that served the request (the same mechanism as "Refresh now").
 *  Returns 0 when the call may go on, or the seconds to wait. Local development (no client address, or a localhost URL) is never limited. */
export async function overLimit(request, cls, nowMs = Date.now()) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const lim = LIMITS[cls]; if (!cache || !lim) return 0;
  const ip = request.headers.get('cf-connecting-ip'); if (!ip || isLocal(new URL(request.url))) return 0;
  const [max, win] = lim; const slot = Math.floor(nowMs / (win * 1000)); const left = Math.max(1, Math.ceil(((slot + 1) * win * 1000 - nowMs) / 1000));
  const key = new Request(`https://tripwire.internal/__rl_v1/${cls}/${encodeURIComponent(ip)}/${slot}`);
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
const istParts = (ms) => { const d = new Date(ms + 330 * 60000); return { day: d.toISOString().slice(0, 10), mins: d.getUTCHours() * 60 + d.getUTCMinutes() }; };

/** Pure: turn a Yahoo chart result into the shape above. Exported for the tests. */
export function parseYahoo(res, nowMs = Date.now()) {
  const q = res?.indicators?.quote?.[0]; const ts = res?.timestamp;
  if (!q || !Array.isArray(ts)) return null;
  const out = { t: [], o: [], h: [], l: [], c: [], forming: false, live: null };
  ts.forEach((t, i) => {
    if (!(q.open?.[i] > 0 && q.high?.[i] > 0 && q.low?.[i] > 0 && q.close?.[i] > 0)) return;
    out.t.push(t); out.o.push(r2(q.open[i])); out.h.push(r2(q.high[i])); out.l.push(r2(q.low[i])); out.c.push(r2(q.close[i]));
  });
  if (out.t.length < 5) return null;
  const now = istParts(nowMs); const last = istParts(out.t[out.t.length - 1] * 1000);
  out.forming = last.day === now.day && now.mins < 15 * 60 + 45;          // the session is still open (or has not closed in the data yet)
  const px = Number(res?.meta?.regularMarketPrice), mt = Number(res?.meta?.regularMarketTime);
  if (px > 0 && mt > 0) out.live = { px: r2(px), t: mt };
  return out;
}

/** Pure: the finished sessions Yahoo's daily rows list but leave incomplete (a null open, high, low or close, which `parseYahoo` drops), newer than the last
 *  complete bar. A session is finished once the IST day has passed, or today after 15:45. These are the days a position can be waiting on for no reason of its own. */
export function incompleteSessions(res, daily, nowMs = Date.now()) {
  const ts = res?.timestamp; if (!Array.isArray(ts) || !daily?.t?.length) return [];
  const have = new Set(daily.t); const lastT = daily.t[daily.t.length - 1]; const now = istParts(nowMs);
  return [...new Set(ts.filter((t) => !have.has(t) && t > lastT).map((t) => istParts(t * 1000).day))]
    .filter((d) => d < now.day || (d === now.day && now.mins >= 15 * 60 + 45));
}
/** Pure: those sessions rebuilt from the five-minute chart. Open is the first 5-minute bar's open, high and low run across the day, close is the last bar's close.
 *  A session is rebuilt only if the chart holds its opening bar (09:15 to 09:25 IST) and a bar from 15:15 IST on; anything less stays missing, never guessed. */
export function rebuildSessions(res5, days) {
  const q = res5?.indicators?.quote?.[0]; const ts = res5?.timestamp; if (!q || !Array.isArray(ts)) return [];
  const out = [];
  for (const day of days) {
    const idx = []; ts.forEach((t, i) => { if (istParts(t * 1000).day === day && q.open?.[i] > 0 && q.high?.[i] > 0 && q.low?.[i] > 0 && q.close?.[i] > 0) idx.push(i); });
    if (idx.length < 20) continue;
    const first = istParts(ts[idx[0]] * 1000), last = istParts(ts[idx[idx.length - 1]] * 1000);
    if (first.mins > 9 * 60 + 25 || last.mins < 15 * 60 + 15) continue;
    out.push({ t: ts[idx[0]], o: r2(q.open[idx[0]]), h: r2(Math.max(...idx.map((i) => q.high[i]))), l: r2(Math.min(...idx.map((i) => q.low[i]))), c: r2(q.close[idx[idx.length - 1]]), day });
  }
  return out;
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
  const key = new Request(`https://tripwire.internal/__chart_v3/${sym}`);
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

// GET /api/ledger -> the nightly forward record, read live from the repository (public) so a new night needs no deploy. Cached ten minutes.
const LEDGER = 'https://raw.githubusercontent.com/caakshayk1-boop/alpha/main/apps/tripwire/ledger/ledger.json';
async function ledger(ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const key = new Request('https://tripwire.internal/__ledger_v1');
  try {
    const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...H, 'cache-control': 'public, max-age=300, s-maxage=600' } });
    const r = await fetch(LEDGER, { signal: AbortSignal.timeout(12000) });
    if (r.status === 404) return json({ ok: false, error: 'the first nightly run has not happened yet' }, 404);
    if (!r.ok) return json({ ok: false, error: 'the record could not be read' }, 502);
    const d = await r.json();
    if (d?.schema !== 'tripwire-ledger/1' || !Array.isArray(d.picks) || !Array.isArray(d.days)) return json({ ok: false, error: 'the record is not in the expected shape' }, 502);
    const res = json({ ok: true, ledger: d }, 200, { 'cache-control': 'public, max-age=300, s-maxage=600' });
    if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch { return json({ ok: false, error: 'the record could not be read' }, 502); }
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
  if (!(px > 0) || !(prev > 0) || t.length < 2) return null;
  return { t, c, px, pt, prev: r2(prev), live: nowMs / 1000 - pt < 25 * 60 };
}
const fetchIntraday = (yahooSymbol, cache, ctx) => coalesce('intra:' + yahooSymbol, () => fetchIntradayOne(yahooSymbol, cache, ctx));
async function fetchIntradayOne(yahooSymbol, cache, ctx) {
  const key = new Request(`https://tripwire.internal/__intra_v2/${yahooSymbol}`);
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
  if (!(px > 0) || !(prev > 0) || t.length < 2) return null;
  return { t, c, px, pt, prev: r2(prev), live: nowMs / 1000 - pt < 25 * 60 };
}
const SPARK = 20;
/** Live quotes for many symbols with few requests: Yahoo's spark endpoint takes twenty at a time, and each batch is cached for six seconds so
 *  every open copy of the app shares it. A batch that fails falls back to one request per symbol. `pairs` is [[ourKey, yahooSymbol], ...]. */
async function sparkMany(pairs, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const out = {}; const missing = [];
  const sorted = [...pairs].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));          // one order for every caller, so the same set is the same cache entry
  const chunks = []; for (let i = 0; i < sorted.length; i += SPARK) chunks.push(sorted.slice(i, i + SPARK));
  await Promise.all(chunks.map(async (ch) => {
    const key = new Request(`https://tripwire.internal/__spark_v1/${ch.map((p) => p[1]).sort().join(',')}`);
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
  return { out, missing };
}
// GET /api/intraday?s=TCS,INFY -> { ok, quotes: { TCS: { t, c, px, pt, prev, live } }, missing }   (up to 30 symbols, one session of 5-minute closes)
// GET /api/pulse            -> the same for Nifty 50, Bank Nifty and India VIX, under their own names
// GET /api/macro            -> the same for gold, silver, Brent, WTI, USD/INR, MYR/INR, USD/MYR and Bitcoin
// GET /api/tick?s=A,B&i=1&m=1 -> everything the screen needs in ONE request: { ok, fetched_at, quotes, pulse?, macro?, missing }   (the app asks every 8 seconds)
const INDICES = { NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', VIX: '^INDIAVIX' };
const LIVE_H = { 'cache-control': 'public, max-age=4, s-maxage=6' };
async function quotes(list, map, ctx) {
  const { out, missing } = await sparkMany(list.map((s) => [s, map(s)]), ctx);
  return json({ ok: Object.keys(out).length > 0, fetched_at: new Date().toISOString(), quotes: out, missing }, 200, LIVE_H);
}
const TICK_MAX = 60;
async function tick(url, ctx) {
  const list = normSymbols(url.searchParams.get('s'), TICK_MAX, 0);
  if (!list) return json({ ok: false, error: `give up to ${TICK_MAX} valid symbols` }, 400);
  const wantI = url.searchParams.get('i') === '1', wantM = url.searchParams.get('m') === '1';
  const pairs = [...list.map((s) => ['s:' + s, `${s}.NS`]), ...(wantI ? Object.entries(INDICES).map(([k, y]) => ['i:' + k, y]) : []), ...(wantM ? Object.entries(MACRO).map(([k, y]) => ['m:' + k, y]) : [])];
  const { out, missing } = await sparkMany(pairs, ctx); const pick = (pre) => Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith(pre)).map(([k, v]) => [k.slice(2), v]));
  const body = { ok: Object.keys(out).length > 0, fetched_at: new Date().toISOString(), quotes: pick('s:'), missing: missing.map((k) => k.slice(2)) }; if (wantI) body.pulse = pick('i:'); if (wantM) body.macro = pick('m:');
  return json(body, 200, LIVE_H);
}

// ---- Breadth: how much of the market is in an uptrend, with today's prices ------------------------------------------------------------
/** Pure. The trend rule, the same as the app's: UP is price above its 50-day and the 50-day above the 200-day, DOWN is the mirror, else mixed. */
export function trendOfRow(price, sma20, sma50, sma200, r3m) {
  if (!(price > 0) || !(sma20 > 0) || !(sma50 > 0) || !(sma200 > 0) || typeof r3m !== 'number' || !Number.isFinite(r3m)) return null;
  if (price > sma20 && sma20 > sma50 && sma50 >= sma200 * 1.01 && r3m > 0) return 'up';
  if (price < sma20 && sma20 < sma50 && sma200 >= sma50 * 1.01 && r3m < 0) return 'down';
  return 'mixed';
}
/** Pure. Counts and sector splits over the liquid names, using a live price where one is given and the published close otherwise. */
export function aggregateBreadth(rows, live = {}) {
  const c = { up: 0, mixed: 0, down: 0 }; const by = new Map();
  for (const r of rows) {
    if (!inBreadth(r)) continue; const lp = live[r.sym]; const t = trendOfRow(lp ?? r.price, r.sma20, r.sma50, r.sma200, lp != null && r.price > 0 && typeof r.r3m === 'number' ? ((lp / r.price) * (1 + r.r3m / 100) - 1) * 100 : r.r3m); if (!t) continue;
    c[t]++; const k = r.sector || 'Other'; const e = by.get(k) ?? { n: 0, up: 0, down: 0 }; e.n++; if (t === 'up') e.up++; if (t === 'down') e.down++; by.set(k, e);
  }
  const n = c.up + c.mixed + c.down;
  const sectors = [...by.entries()].filter(([, e]) => e.n >= MIN_SECTOR).map(([k, e]) => ({ k, n: e.n, up: Math.round((e.up / e.n) * 1000) / 10, down: Math.round((e.down / e.n) * 1000) / 10 })).sort((a, b) => b.n - a.n);
  return { n, ...c, sectors };
}
// GET /api/breadth -> { ok, t, as_of, n, up, mixed, down, sectors:[{k,n,up,down}], repriced, near }. Only a name within 8% of its 50-day average can change class in a
// day, so only those are re-priced (about twenty requests); the rest keep the published close. Cached 60 s and shared by every open copy of the app.
const breadth = (request, env, ctx) => coalesceResponse('breadth', () => breadthOne(request, env, ctx));
async function breadthOne(request, env, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const key = new Request('https://tripwire.internal/__breadth_v1');
  try {
    const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...H, 'cache-control': 'public, max-age=30, s-maxage=60' } });
    const scr = await (await env.ASSETS.fetch(new Request(new URL('/data/screen.json', request.url)))).json();
    const rows = (scr.rows || []).filter(inBreadth);       // the same predicate the Data screen explains (shared/breadthrule.js)
    // only a name close to one of the lines the rule reads (the 20-day, the 50-day, or a 3-month return near zero) can change class in a day
    const near = rows.filter((r) => Math.abs(r.price / r.sma20 - 1) <= 0.06 || Math.abs(r.price / r.sma50 - 1) <= 0.08 || Math.abs(r.r3m) <= 6).slice(0, 400);
    const { out } = await sparkMany(near.map((r) => [r.sym, `${r.sym}.NS`]), ctx);
    // a quote is used only if it printed within two days of now; an old one (a halted name) is ignored, never blended
    const live = {}; for (const [k, q] of Object.entries(out)) if (Date.now() / 1000 - q.pt < 2 * 86400) live[k] = q.px;
    const res = json({ ok: true, t: Date.now(), as_of: scr.as_of, ...aggregateBreadth(rows, live), repriced: Object.keys(live).length, near: near.length }, 200, { 'cache-control': 'public, max-age=30, s-maxage=60' });
    if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch { return json({ ok: false, error: 'the market breadth could not be computed' }, 502); }
}
// GET /api/factors -> the nightly factor sheet (percentiles of the less common indicators), read from the repository like the ledger
const FACTORS = 'https://raw.githubusercontent.com/caakshayk1-boop/alpha/main/apps/tripwire/ledger/factors.json';
async function factors(ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const key = new Request('https://tripwire.internal/__factors_v1');
  try {
    const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...H, 'cache-control': 'public, max-age=300, s-maxage=1800' } });
    const r = await fetch(FACTORS, { signal: AbortSignal.timeout(12000) });
    if (r.status === 404) return json({ ok: false, error: 'the first nightly factor run has not happened yet' }, 404);
    if (!r.ok) return json({ ok: false, error: 'the factor sheet could not be read' }, 502);
    const d = await r.json();
    if (d?.schema !== 'tripwire-factors/1' || typeof d.rows !== 'object') return json({ ok: false, error: 'the factor sheet is not in the expected shape' }, 502);
    const res = json({ ok: true, ...d }, 200, { 'cache-control': 'public, max-age=300, s-maxage=1800' });
    if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch { return json({ ok: false, error: 'the factor sheet could not be read' }, 502); }
}

// GET /api/rsi -> RSI 14 on daily, weekly and monthly closes for every name in the nightly panel: { schema, as_of, order, rows: { SYM: [d, w, m] } }
const RSI = 'https://raw.githubusercontent.com/caakshayk1-boop/alpha/main/apps/tripwire/ledger/rsi.json';
async function rsiSheet(ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const key = new Request('https://tripwire.internal/__rsi_v1');
  try {
    const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...H, 'cache-control': 'public, max-age=300, s-maxage=1800' } });
    const r = await fetch(RSI, { signal: AbortSignal.timeout(12000) });
    if (r.status === 404) return json({ ok: false, error: 'the first nightly RSI run has not happened yet' });
    if (!r.ok) return json({ ok: false, error: 'the RSI sheet could not be read' });
    const d = await r.json();
    if (d?.schema !== 'tripwire-rsi/1' || typeof d.rows !== 'object') return json({ ok: false, error: 'the RSI sheet is not in the expected shape' });
    const res = json({ ok: true, ...d }, 200, { 'cache-control': 'public, max-age=300, s-maxage=1800' });
    if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch { return json({ ok: false, error: 'the RSI sheet could not be read' }); }
}

// ---- News -------------------------------------------------------------------------------------------------------------------------
// THREE routes, one pipeline (apps/tripwire/news/*, shared with the scheduled job):
//   GET /api/news/version  -> the tiny status document the job writes every run: { ok, snapshotVersion, status, checkedAt, lastSuccessfulAt, nextScheduledAt, ... }  (edge copy 60 s)
//   GET /api/news          -> the latest published snapshot for the browser: { ok, schema: 'tripwire-news/1', events, scopes, names, sources, rejections, ... }       (edge copy 5 min)
//   GET /api/news/catchup  -> only when the published check is late (any hour): a market-scope run of the same pipeline, labelled on demand, edge copy one cadence (news/catchup.js)
//   GET /api/news?q=<phrase>&sym=<SYMBOL>  -> a live query for one reader-chosen name, run through the SAME pipeline and gates, edge copy 5 minutes
// The snapshot is written by .github/workflows/tripwire_news.yml on the orphan branch `tripwire-data` and read from raw.githubusercontent.com, like the ledger and the RSI sheet.
// Absent or unreadable answers HTTP 200 with ok:false (a 404 or 5xx is a console error in every browser); `retry_after` (seconds) is passed through when the upstream gave one.
// Nothing here is a model. Event types are keyword rules, the ranker is a weighted sum (news/rank.js), and a headline that names no covered company or India-wide event is dropped.
const NEWS_BASE = 'https://raw.githubusercontent.com/caakshayk1-boop/alpha/tripwire-data/';
const NEWS_FILES = { snapshot: ['news-browser.json', 'tripwire-news/1', 300], version: ['news-status.json', 'tripwire-news-status/1', 60] };
const RL_SECONDS = 30;
/** Best-effort limit on "Refresh now": one forced call per client address per 30 seconds, kept in the edge cache of the data centre that served it. Not a security control. */
async function forcedTooSoon(request, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; if (!cache) return false;
  const ip = request.headers.get('cf-connecting-ip') || 'local'; const key = new Request(`https://tripwire.internal/__news_rl/${encodeURIComponent(ip)}`);
  if (await cache.match(key)) return true;
  const mark = new Response('1', { headers: { 'cache-control': `max-age=${RL_SECONDS}` } }); if (ctx) ctx.waitUntil(cache.put(key, mark)); else await cache.put(key, mark);
  return false;
}
const tooMany = () => json({ ok: false, error: 'checked a moment ago', retry_after: RL_SECONDS }, 429, { 'retry-after': String(RL_SECONDS), 'cache-control': 'no-store' });
async function newsFile(which, ctx, force, minVersion = 0) {
  const [file, schema, ttl] = NEWS_FILES[which]; const cache = typeof caches !== 'undefined' ? caches.default : null; const key = new Request(`https://tripwire.internal/__news_file_v1/${file}`);
  const keep = { 'cache-control': `public, max-age=${Math.min(ttl, 60)}, s-maxage=${ttl}` };
  try {
    let hit = !force && cache && await cache.match(key);
    // A reader that already knows a newer version exists (from the status file) must not be handed an older cached copy.
    if (hit && minVersion > 0) { const d0 = await hit.clone().json().catch(() => null); if (!(Number(d0?.snapshotVersion) >= minVersion)) hit = null; }
    if (hit) return new Response(hit.body, { headers: { ...H, ...keep } });
    const r = await fetch(NEWS_BASE + file, { signal: AbortSignal.timeout(12000), headers: { 'cache-control': 'no-cache' } });
    if (r.status === 404) return json({ ok: false, reason: 'absent', error: 'the first news check has not been published yet' }, 200, { 'cache-control': 'public, max-age=30, s-maxage=30' });
    if (!r.ok) { const ra = Number(r.headers.get('retry-after')); return json({ ok: false, reason: 'upstream', status: r.status, error: 'the news snapshot could not be read', ...(Number.isFinite(ra) && ra > 0 ? { retry_after: Math.min(ra, 3600) } : {}) }, 200, { 'cache-control': 'no-store' }); }
    const d = await r.json();
    if (d?.schema !== schema) return json({ ok: false, reason: 'shape', error: 'the news snapshot is not in the expected shape' }, 200, { 'cache-control': 'no-store' });
    const res = json({ ok: true, ...d, served_at: new Date().toISOString() }, 200, keep);
    if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch { return json({ ok: false, reason: 'upstream', error: 'the news snapshot could not be read' }, 200, { 'cache-control': 'no-store' }); }
}
/** The company a live query is about: the quoted phrase of `"Name" when:7d`. A query with no quoted name is a market query: no company, only India-wide events pass. */
const queryEntity = (q, sym) => { const m = q.match(/"([^"]{2,80})"/); return m ? [{ sym: sym || null, name: m[1], aliases: ALIASES[sym] ?? [] }] : []; };
const QOK = /^[\p{L}\p{N} .,&'"()\-:+%]{2,110}$/u;
async function news(url, ctx, request) {
  const q = (url.searchParams.get('q') || '').trim(); const force = url.searchParams.get('force') === '1';
  if (!q) { if (force && await forcedTooSoon(request, ctx)) return tooMany(); return newsFile('snapshot', ctx, force, Number(url.searchParams.get('v')) || 0); }
  if (!QOK.test(q)) return json({ ok: false, error: 'give a short search phrase' }, 400);
  const sym = (url.searchParams.get('sym') || '').toUpperCase(); if (sym && !SYM.test(sym)) return json({ ok: false, error: 'not a valid symbol' }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null; const key = new Request(`https://tripwire.internal/__news_q_v2/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, ' '))}/${sym}`);
  const H1 = { 'cache-control': 'public, max-age=60, s-maxage=300' };      // five minutes at the edge
  try {
    const hit = cache && await cache.match(key);
    if (hit) { const body = await hit.text(); let age = Infinity; try { age = (Date.now() - Date.parse(JSON.parse(body).checkedAt)) / 1000; } catch { /* unreadable copy: old */ }
      if (!(force && age >= 60)) return new Response(body, { headers: { ...H, ...H1 } });
      if (await forcedTooSoon(request, ctx)) return tooMany(); }
    else if (force && await forcedTooSoon(request, ctx)) return tooMany();
    return await coalesceResponse('nq:' + key.url, () => newsLive(q, sym, key, cache, ctx, H1));
  } catch { return json({ ok: false, error: 'the news source did not answer' }, 200, { 'cache-control': 'no-store' }); }
}
/** The live query itself: Google News, then Bing News. Concurrent identical queries share one run. */
async function newsLive(q, sym, key, cache, ctx, H1) {
  try {
    const days = Number(q.match(/when:(\d+)d/)?.[1] ?? 7); const tried = []; let retryAfter = 0;
    const order = [FEEDS.google, FEEDS.bing];                                   // Google News first; Bing News with the same words when Google refuses or has nothing
    for (const feed of order) {
      try {
        const r = await fetch(feed.url(q), { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/rss+xml,text/xml' }, signal: AbortSignal.timeout(9000) });
        if (!r.ok) { tried.push(`${feed.id} ${r.status}`); const ra = Number(r.headers.get('retry-after')); if (ra > retryAfter) retryAfter = ra; continue; }
        const raw = parseFeed(await r.text()); const nowMs = Date.now();
        const p = runPipeline({ batches: [{ feed, rawItems: raw, fetchedAt: new Date(nowMs).toISOString() }], registry: buildRegistry(queryEntity(q, sym)), nowMs, full: false, limit: 20 });
        if (!p.events.length && feed === FEEDS.google && p.counts.seen === 0) { tried.push(`${feed.id} no items`); continue; }
        const body = { ok: true, schema: QUERY_SCHEMA, checkedAt: new Date(nowMs).toISOString(), q, sym: sym || null, via: feed.id, status: tried.length ? 'partial' : 'ok', days, events: p.events.map(compactEvent), rejections: p.rejections, counts: p.counts, rankingVersion: p.rankingVersion, pipelineVersion: p.pipelineVersion };
        const res = json(body, 200, H1); if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone())); return res;
      } catch { tried.push(`${feed.id} failed`); }
    }
    return json({ ok: false, error: `the news sources did not answer (${tried.join(', ')})`, ...(retryAfter > 0 ? { retry_after: Math.min(retryAfter, 3600) } : {}) }, 200, { 'cache-control': 'no-store' });
  } catch { return json({ ok: false, error: 'the news source did not answer' }, 200, { 'cache-control': 'no-store' }); }
}

/** GET /api/news/catchup: when the PUBLISHED snapshot is late (older than two cadences, at any hour), run the market scope of the same pipeline once and cache it at the edge for one
 *  cadence. Labelled `onDemand` in its own schema; the published snapshot's times and events are never changed or re-dated (apps/tripwire/news/catchup.js, docs/tripwire/launch/RELIABILITY.md).
 *  Not late: answers `onDemand:false` with the reason and does no work. A failed attempt is remembered for two minutes so a stalled source is not asked on every page view. */
async function catchup(ctx) {
  const nowMs = Date.now(); const vr = await (await newsFile('version', ctx, false)).json().catch(() => null); const status = vr?.ok ? vr : null;
  const d = catchupDecision({ status, nowMs });
  if (!d.run) return json({ ok: true, onDemand: false, reason: d.reason, ageMin: d.ageMin }, 200, { 'cache-control': 'public, max-age=60, s-maxage=60' });
  const cache = typeof caches !== 'undefined' ? caches.default : null; const key = new Request('https://tripwire.internal/__news_catchup_v1');
  const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...H, 'cache-control': 'public, max-age=60, s-maxage=300' } });
  return coalesceResponse('catchup', () => catchupRun(nowMs, status, d, cache, key, ctx));
}
async function catchupRun(nowMs, status, d, cache, key, ctx) {
  const snap = status ? await (await newsFile('snapshot', ctx, false)).json().catch(() => null) : null;
  let body; try { body = await runCatchup({ fetchImpl: fetch, nowMs, status, snapshot: snap?.ok ? snap : null, decision: d }); } catch { body = { ok: false, error: 'the on-demand refresh failed' }; }
  const ttl = body.ok ? 900 : 120; const res = json(body, 200, { 'cache-control': `public, max-age=60, s-maxage=${ttl}` }); if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone())); return res;
}

async function bars(url, ctx) {
  const list = normSymbols(url.searchParams.get('s'), MAX);
  if (!list) return json({ ok: false, error: `give 1 to ${MAX} valid symbols` }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const out = {}; const missing = [];
  await Promise.all(list.map(async (s) => {
    try { const p = await coalesce('bars:' + s, () => barsOne(s, cache, ctx)); if (p) out[s] = p; else missing.push(s); } catch { missing.push(s); }          // absent, never zero
  }));
  return json({ ok: Object.keys(out).length > 0, fetched_at: new Date().toISOString(), bars: out, missing }, 200);
}
/** One symbol's six months of daily bars from Yahoo, or null when it has none. Cached five minutes at the edge; concurrent callers share one fetch. */
async function barsOne(s, cache, ctx) {
  const key = new Request(`https://tripwire.internal/__bars_v2/${s}`);
  const hit = cache && await cache.match(key); if (hit) return hit.json();
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}.NS?range=6mo&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) return null;
  const res = (await r.json())?.chart?.result?.[0]; const p = parseYahoo(res); if (!p) return null;
  const gaps = incompleteSessions(res, p);
  if (gaps.length) {                 // a finished session Yahoo's daily row has no complete bar for: rebuild it from the five-minute chart, and say so
    try {
      const r5 = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}.NS?range=5d&interval=5m`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
      const add = r5.ok ? rebuildSessions((await r5.json())?.chart?.result?.[0], gaps) : [];
      for (const b of add) { p.t.push(b.t); p.o.push(b.o); p.h.push(b.h); p.l.push(b.l); p.c.push(b.c); }
      if (add.length) p.rebuilt = add.map((b) => b.day);
    } catch { /* the sessions stay missing */ }
  }
  if (cache && ctx) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } })));
  return p;
}

/** Pure: the health answer, from the probe results and the NAMES of the bindings the Worker was given. A binding's value, and any secret's, never appears: only that it exists. */
export function healthShape(probes, bindingNames, nowMs = Date.now()) {
  const p = probes.prices ?? {}; const n = probes.news ?? {};
  return { ok: !!(p.ok && n.ok), checked_at: new Date(nowMs).toISOString(),
    prices: { ok: !!p.ok, ms: p.ms ?? null, last_print: p.printSec ? new Date(p.printSec * 1000).toISOString() : null, age_sec: p.printSec ? Math.max(0, Math.round(nowMs / 1000 - p.printSec)) : null, error: p.ok ? null : (p.error ?? 'no answer') },
    news: { ok: !!n.ok && n.newsStatus !== 'failed', ms: n.ms ?? null, error: n.ok ? (n.newsStatus === 'failed' ? 'the latest news check failed' : null) : (n.error ?? 'no answer'), status: n.newsStatus ?? null, last_successful_at: n.lastGood ?? null, checked_at: n.checkedAt ?? null },
    bindings: [...bindingNames].sort(), secrets_configured: 0 };
}
async function probe(url, pick) {
  const t0 = Date.now();
  try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' }, signal: AbortSignal.timeout(6000) }); if (!r.ok) return { ok: false, ms: Date.now() - t0, error: `HTTP ${r.status}` };
    const extra = pick ? await pick(r) : {}; return { ok: true, ms: Date.now() - t0, ...extra }; } catch (e) { return { ok: false, ms: Date.now() - t0, error: String(e?.message ?? e).slice(0, 80) }; }
}
async function health(env, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const key = new Request('https://tripwire.internal/__health_v1');
  const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { headers: H });
  const [prices, nws] = await Promise.all([
    probe('https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=1d&interval=5m', async (r) => { const j = await r.json(); return { printSec: Number(j?.chart?.result?.[0]?.meta?.regularMarketTime) || null }; }),
    probe(NEWS_BASE + 'news-status.json', async (r) => { const j = await r.json(); return { newsStatus: j?.status ?? null, lastGood: j?.lastSuccessfulAt ?? null, checkedAt: j?.checkedAt ?? null }; }),   // the published news status, not a probe of Google
  ]);
  const body = JSON.stringify(healthShape({ prices, news: nws }, Object.keys(env ?? {}))); const res = new Response(body, { headers: { ...H, 'cache-control': 'public, max-age=60' } });
  if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone())); return res;
}

/** /data/* is a set of files, not pages. The asset layer answers an unknown path with the app shell (HTTP 200, text/html) because the app is a single-page app; for data that
 *  is a lie (a missing company file looked like a success and failed later as a JSON parse error). Here a path that resolves to the shell, or to nothing, is a real 404 with a JSON body. */
export async function dataAsset(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'GET only' }, 405);
  const res = await env.ASSETS.fetch(request); const type = res.headers.get('content-type') || '';
  if (res.status === 404 || res.status >= 500 || /text\/html/i.test(type)) return json({ ok: false, error: 'not found', path: new URL(request.url).pathname }, 404, { 'cache-control': 'no-store' });
  const out = new Response(res.body, res); for (const [k, v] of Object.entries(SECURITY)) if (!out.headers.has(k)) out.headers.set(k, v);
  if (!out.headers.has('x-content-type-options')) out.headers.set('x-content-type-options', 'nosniff'); return out;
}

/** The app shell (index.html). The static headers send `Cache-Control: no-transform` so Cloudflare does not inject its analytics beacon, which the CSP blocks; but no-transform also stops Cloudflare from
 *  compressing the page (36 KB instead of about 11 KB, flagged by PageSpeed as "Document request latency, est. savings 24 KiB"). So the page is compressed inside the Worker: setting
 *  `Content-Encoding: gzip` on a plain body makes the Workers runtime encode it for the client (its default `encodeBody: "automatic"`; compressing it here as well would encode it twice, which an earlier
 *  version of this function did). Cloudflare rewrites the Accept-Encoding the Worker sees to include gzip, and keeps the client's own value in `request.cf.clientAcceptEncoding`: whether to encode is decided from that original value when it is present (a local
 *  workerd does not rewrite it, so there the header is the client's own). The validator is dropped because it described the plain bytes. */
export async function shellAsset(request, env) {
  const res = await env.ASSETS.fetch(request);
  if (!res.ok || !res.body || res.headers.get('content-encoding') || !/text\/html/i.test(res.headers.get('content-type') || '')) return res;
  const out = new Response(res.body, res);
  out.headers.append('vary', 'Accept-Encoding');
  const gzip = String(request.cf?.clientAcceptEncoding ?? request.headers.get('accept-encoding') ?? '').split(',').some((v) => /^gzip\s*(?:;\s*q\s*=\s*(?:1(?:\.0*)?|0?\.\d+))?\s*$/i.test(v.trim()) && !/q\s*=\s*0(?:\.0*)?\s*$/i.test(v));
  if (!gzip) return out;
  out.headers.delete('content-length'); out.headers.delete('etag'); out.headers.set('content-encoding', 'gzip');
  return out;
}

export default {
  /** Cloudflare cron trigger (wrangler.tripwire.jsonc): asks GitHub to start the news job. Does nothing at all until the secret GITHUB_DISPATCH_TOKEN is set (news/nudge.js). */
  async scheduled(_event, env, ctx) {
    if (!env?.GITHUB_DISPATCH_TOKEN) return;
    const status = await (await newsFile('version', ctx, true)).json().catch(() => null);
    ctx.waitUntil(nudge({ env, nowMs: Date.now(), fetchImpl: fetch, status: status?.ok ? status : null }).then((r) => console.log('news nudge:', r.sent ? 'sent' : 'not sent', r.why)));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (url.search.length > MAX_SEARCH) return json({ ok: false, error: 'request too long' }, 414, { 'cache-control': 'no-store' });
      const cls = request.method === 'GET' ? ROUTE_CLASS[url.pathname.length > 5 ? url.pathname.replace(/\/$/, '') : url.pathname] : null;
      if (cls) { const wait = await overLimit(request, cls); if (wait) return slowDown(wait); }
    }
    if (url.pathname === '/api/bars' || url.pathname === '/api/bars/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return bars(url, ctx);
    }
    if (url.pathname === '/api/chart' || url.pathname === '/api/chart/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return chart(url, ctx);
    }
    if (url.pathname === '/api/ledger' || url.pathname === '/api/ledger/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return ledger(ctx);
    }
    if (url.pathname === '/api/intraday' || url.pathname === '/api/intraday/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      const list = normSymbols(url.searchParams.get('s'), MAX_QUOTES);
      if (!list) return json({ ok: false, error: `give 1 to ${MAX_QUOTES} valid symbols` }, 400);
      return quotes(list, (s) => `${s}.NS`, ctx);
    }
    if (url.pathname === '/api/pulse' || url.pathname === '/api/pulse/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return quotes(Object.keys(INDICES), (s) => INDICES[s], ctx);
    }
    if (url.pathname === '/api/tick' || url.pathname === '/api/tick/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return tick(url, ctx);
    }
    if (url.pathname === '/api/breadth' || url.pathname === '/api/breadth/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return breadth(request, env, ctx);
    }
    if (url.pathname === '/api/macro' || url.pathname === '/api/macro/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return quotes(Object.keys(MACRO), (s) => MACRO[s], ctx);
    }
    if (url.pathname === '/api/news/catchup') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return catchup(ctx);
    }
    if (url.pathname === '/api/news/version') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      const force = url.searchParams.get('force') === '1'; if (force && await forcedTooSoon(request, ctx)) return tooMany();
      return newsFile('version', ctx, force);
    }
    if (url.pathname === '/api/news' || url.pathname === '/api/news/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return news(url, ctx, request);
    }
    if (url.pathname === '/api/health' || url.pathname === '/api/health/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return health(env, ctx);
    }
    if (url.pathname === '/api/factors' || url.pathname === '/api/factors/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return factors(ctx);
    }
    if (url.pathname === '/api/rsi' || url.pathname === '/api/rsi/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return rsiSheet(ctx);
    }
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'not found' }, 404);
    if (url.pathname.startsWith('/data/')) return dataAsset(request, env);
    if (url.pathname === '/' || url.pathname === '/index.html') return shellAsset(request, env);
    return env.ASSETS.fetch(request);
  },
};
