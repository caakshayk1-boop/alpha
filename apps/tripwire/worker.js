// Tripwire Worker: static assets plus two read-only routes: /api/bars (paper tracker) and /api/chart (price history).
//   GET /api/bars?s=TCS,INFY   (up to 12 NSE symbols)
//   -> { ok, fetched_at, bars: { TCS: { t:[epoch s], o:[], h:[], l:[], c:[], forming: bool, live: { px, t } | null } }, missing: [] }
// Daily bars for six months from Yahoo Finance. A bar missing any of open, high, low or close is dropped, never filled. The last bar
// is marked `forming` while its session is still open (IST), so the tracker never treats it as a close. Cached five minutes per
// symbol. No secrets, no storage, no user data: the request carries only symbols.
const SYM = /^[A-Z0-9&-]{1,20}$/;
const MAX = 12;
const H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60, s-maxage=300', 'x-content-type-options': 'nosniff' };
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...H, ...extra } });
const r2 = (x) => Math.round(x * 100) / 100;
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

/** Pure: Yahoo's long daily history reduced to epoch seconds and closes. A day missing its close is dropped, never filled. */
export function parseChart(res) {
  const ts = res?.timestamp; const cl = res?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(cl)) return null;
  const t = [], c = [];
  ts.forEach((x, i) => { if (cl[i] > 0 && x > 0) { t.push(x); c.push(Math.round(cl[i] * 100) / 100); } });
  return t.length >= 30 ? { t, c } : null;
}
// GET /api/chart?s=TCS  ->  { ok, sym, t:[epoch s], c:[close] } : every daily close Yahoo holds (up to the whole listing), split-adjusted, dividends not included.
// The page makes its own ranges and its monthly view from this one series. Cached six hours: a close does not change after the session.
async function chart(url, ctx) {
  const sym = (url.searchParams.get('s') || '').toUpperCase().trim();
  if (!SYM.test(sym)) return json({ ok: false, error: 'bad symbol' }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(`https://tripwire.internal/__chart_v1/${sym}`);
  try {
    const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...H, 'cache-control': 'public, max-age=1800, s-maxage=21600' } });
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}.NS?range=max&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return json({ ok: false, error: r.status === 404 ? 'no price history for this symbol' : 'the price source did not answer' }, r.status === 404 ? 404 : 502);
    const p = parseChart((await r.json())?.chart?.result?.[0]);
    if (!p) return json({ ok: false, error: 'too little history' }, 404);
    const res = json({ ok: true, sym, ...p }, 200, { 'cache-control': 'public, max-age=1800, s-maxage=21600' });
    if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch { return json({ ok: false, error: 'the price source did not answer' }, 502); }
}

async function bars(url, ctx) {
  const list = [...new Set((url.searchParams.get('s') || '').toUpperCase().split(',').map((x) => x.trim()).filter(Boolean))];
  if (!list.length || list.length > MAX || !list.every((s) => SYM.test(s))) return json({ ok: false, error: `give 1 to ${MAX} valid symbols` }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const out = {}; const missing = [];
  await Promise.all(list.map(async (s) => {
    const key = new Request(`https://tripwire.internal/__bars_v1/${s}`);
    try {
      const hit = cache && await cache.match(key); if (hit) { out[s] = await hit.json(); return; }
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}.NS?range=6mo&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
      if (!r.ok) { missing.push(s); return; }
      const p = parseYahoo((await r.json())?.chart?.result?.[0]);
      if (!p) { missing.push(s); return; }
      out[s] = p;
      if (cache && ctx) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } })));
    } catch { missing.push(s); }          // absent, never zero
  }));
  return json({ ok: Object.keys(out).length > 0, fetched_at: new Date().toISOString(), bars: out, missing }, 200);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/bars' || url.pathname === '/api/bars/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return bars(url, ctx);
    }
    if (url.pathname === '/api/chart' || url.pathname === '/api/chart/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return chart(url, ctx);
    }
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
