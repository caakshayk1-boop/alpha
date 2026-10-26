// Tripwire Worker: static assets plus read-only routes: /api/bars and /api/intraday (paper tracker, live P&L, list quotes), /api/pulse (index strip), /api/macro (gold, silver, oil, FX, Bitcoin), /api/news (cleaned headlines, cached an hour), /api/chart (price history), /api/ledger (forward record), /api/factors (nightly factor sheet).
//   GET /api/bars?s=TCS,INFY   (up to 30 NSE symbols)
//   -> { ok, fetched_at, bars: { TCS: { t:[epoch s], o:[], h:[], l:[], c:[], forming: bool, live: { px, t } | null } }, missing: [] }
// Daily bars for six months from Yahoo Finance. A bar missing any of open, high, low or close is dropped, never filled. The last bar
// is marked `forming` while its session is still open (IST), so the tracker never treats it as a close. Cached five minutes per
// symbol. No secrets, no storage, no user data: the request carries only symbols.
const SYM = /^[A-Z0-9&-]{1,20}$/;
const MAX = 30;                              // symbols a call may ask for (list quotes, the paper books): one Yahoo call each, cached 60 s (quotes) or 5 min (bars)
const MAX_QUOTES = MAX;
// Macro instruments, by the name the app uses. Yahoo's symbols: COMEX futures for gold, silver, WTI; ICE for Brent; spot FX; Bitcoin in dollars.
export const MACRO = { GOLD: 'GC=F', SILVER: 'SI=F', BRENT: 'BZ=F', WTI: 'CL=F', USDINR: 'INR=X', MYRINR: 'MYRINR=X', USDMYR: 'MYR=X', BTC: 'BTC-USD' };
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
export function parseChart(res, niftyRes) {
  const ts = res?.timestamp; const cl = res?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(cl)) return null;
  const t = [], c = [];
  ts.forEach((x, i) => { if (cl[i] > 0 && x > 0) { t.push(x); c.push(Math.round(cl[i] * 100) / 100); } });
  if (t.length < 30) return null;
  // the Nifty close on the same Indian calendar day; null where the index has no figure (never filled from another day)
  const day = (x) => Math.floor((x + 19800) / 86400); const nm = new Map();
  const nt = niftyRes?.timestamp, nc = niftyRes?.indicators?.quote?.[0]?.close;
  if (Array.isArray(nt) && Array.isArray(nc)) nt.forEach((x, i) => { if (nc[i] > 0) nm.set(day(x), Math.round(nc[i] * 100) / 100); });
  const n = t.map((x) => (nm.has(day(x)) ? nm.get(day(x)) : null));
  return { t, c, n: n.some((v) => v !== null) ? n : null };
}
// GET /api/chart?s=TCS  ->  { ok, sym, t:[epoch s], c:[close] } : every daily close Yahoo holds (up to the whole listing), split-adjusted, dividends not included, with the Nifty 50 close of the same day in `n` (null where absent; the whole field is null if the index could not be read).
// The page makes its own ranges and its monthly view from this one series. Cached six hours: a close does not change after the session.
async function chart(url, ctx) {
  const sym = (url.searchParams.get('s') || '').toUpperCase().trim();
  if (!SYM.test(sym)) return json({ ok: false, error: 'bad symbol' }, 400);
  const macro = Object.prototype.hasOwnProperty.call(MACRO, sym);          // an instrument, not an NSE share: its own Yahoo symbol, and no Nifty line
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(`https://tripwire.internal/__chart_v1/${sym}`);
  try {
    const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...H, 'cache-control': 'public, max-age=1800, s-maxage=21600' } });
    const get = (s) => fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=max&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    const [r, nr] = await Promise.all([get(macro ? MACRO[sym] : `${sym}.NS`), macro ? Promise.resolve(null) : get('^NSEI').catch(() => null)]);
    if (!r.ok) return json({ ok: false, error: r.status === 404 ? 'no price history for this symbol' : 'the price source did not answer' }, r.status === 404 ? 404 : 502);
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
async function fetchIntraday(yahooSymbol, cache, ctx) {
  const key = new Request(`https://tripwire.internal/__intra_v1/${yahooSymbol}`);
  const hit = cache && await cache.match(key); if (hit) return hit.json();
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=5m`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) return null;
  const p = parseIntraday((await r.json())?.chart?.result?.[0]); if (!p) return null;
  if (cache && ctx) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } })));
  return p;
}
// GET /api/intraday?s=TCS,INFY -> { ok, quotes: { TCS: { t, c, px, pt, prev, live } }, missing }   (up to 30 symbols, one session of 5-minute closes)
// GET /api/pulse            -> the same for Nifty 50, Bank Nifty and India VIX, under their own names
// GET /api/macro            -> the same for gold, silver, Brent, WTI, USD/INR, MYR/INR, USD/MYR and Bitcoin
const INDICES = { NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', VIX: '^INDIAVIX' };
async function quotes(list, map, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null; const out = {}; const missing = [];
  await Promise.all(list.map(async (s) => { try { const p = await fetchIntraday(map(s), cache, ctx); if (p) out[s] = p; else missing.push(s); } catch { missing.push(s); } }));
  return json({ ok: Object.keys(out).length > 0, fetched_at: new Date().toISOString(), quotes: out, missing }, 200, { 'cache-control': 'public, max-age=30, s-maxage=60' });
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

// ---- News -------------------------------------------------------------------------------------------------------------------------
// GET /api/news?q=<search>  -> { ok, fetched_at, q, items: [{ title, source, url, t, tags, also }] }
// Google News' public RSS for the query, cleaned by fixed rules (below), cached one hour at the edge. The rules are plain code, not a model:
// they drop what is not English and search-engine filler, folds the same story from several outlets into one line, and tags headlines by keyword.
// The tags say what a headline is ABOUT. They never say whether it is good or bad news.
const decode = (x) => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1].replace(/<!\[CDATA\[|\]\]>/g, '')).trim() : ''; };
const STOP = new Set('a an the of to in on for and or at by with from as is are be its it this that after over into amid says said new share shares stock stocks price prices today news live update updates latest rs'.split(' '));
export const TAGS = [
  ['Results', /\b(q[1-4]\b|quarter|quarterly|results?|net profit|earnings|revenue|ebitda|profit)\b/i],
  ['IPO', /\b(ipo|listing|price band|anchor investors?|subscription|gmp)\b/i],
  ['Deal', /\b(acquires?|acquisition|merger|demerger|stake|block deal|bulk deal|buyback|open offer|takeover|fundrais|qip)\b/i],
  ['Order', /\b(orders?|contracts?|bags|wins|secures)\b/i],
  ['Rating', /\b(upgrade[sd]?|downgrade[sd]?|target|initiates coverage|rating|brokerage)\b/i],
  ['Payout', /\b(dividend|bonus|stock split|record date)\b/i],
  ['Regulator', /\b(sebi|rbi|nclt|penalty|fined|fines|probe|fraud|raid|cbi|banned|show-cause|notice)\b/i],
  ['People', /\b(appoints?|appointed|joins|resigns?|steps down|ceo|cfo|managing director)\b/i],
];
const WEIGHT = { Results: 5, Deal: 5, Regulator: 5, IPO: 4, Order: 4, Payout: 4, Rating: 3, People: 1 };
const FILLER = /(share price (news|today|live)|stock price (today|live)|\bshare price\b.*:\s|top \d+ stocks? to buy|stocks? to (buy|watch) (today|tomorrow)|multibagger|penny stock)/i;
const latinShare = (t) => { const L = (t.match(/\p{L}/gu) || []); return L.length ? L.filter((c) => /[A-Za-z]/.test(c)).length / L.length : 0; };
const words = (t) => new Set(t.toLowerCase().replace(/[^a-z0-9₹ ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
// the same story from another outlet shares most of the shorter headline's words (and at least four of them)
const sameStory = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i >= 4 && i / Math.min(a.size, b.size) >= 0.7; };

/** Pure: Google News RSS text to cleaned items, newest and most material first. Exported for the tests. */
export function parseNews(xml, nowMs = Date.now(), max = 8, maxAgeDays = 14) {
  const raw = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1]; let title = tag(b, 'title'); const source = tag(b, 'source') || tag(b, 'News:Source'); let link = tag(b, 'link'); const t = Math.floor(Date.parse(tag(b, 'pubDate')) / 1000);
    const direct = link.match(/^https?:\/\/(?:www\.)?bing\.com\/news\/apiclick\.aspx\?.*?[?&]url=([^&]+)/); if (direct) { try { link = decodeURIComponent(direct[1]); } catch { /* keep the click link */ } }
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
    if (!title || !/^https:\/\//.test(link) || !(t > 0)) continue;
    if (latinShare(title) < 0.8) continue;                       // not English: not shown rather than shown unreadable
    if (FILLER.test(title)) continue;                            // search-engine filler, not news
    if (t * 1000 > nowMs + 3600e3) continue;                     // dated in the future: a bad feed
    if (t * 1000 < nowMs - maxAgeDays * 86400e3) continue;       // older than the window asked for (Bing does not honour when:)
    raw.push({ title, source: source || 'Unknown', url: link, t, w: words(title) });
  }
  raw.sort((a, b) => b.t - a.t);
  const kept = [];
  for (const it of raw) {                                        // one line per story: a later outlet repeating it is counted, not listed
    const dup = kept.find((k) => sameStory(k.w, it.w));
    if (dup) { dup.also++; if (!dup.sources.includes(it.source)) dup.sources.push(it.source); continue; }
    kept.push({ ...it, also: 0, sources: [it.source] });
  }
  const scored = kept.map((k) => {
    const tags = TAGS.filter(([, re]) => re.test(k.title)).map(([n]) => n);
    const mat = Math.max(0, ...tags.map((n) => WEIGHT[n] || 0));
    const ageH = Math.max(0, (nowMs / 1000 - k.t) / 3600);
    return { ...k, tags, score: mat + 2 * Math.min(k.also, 3) + 6 * Math.exp(-ageH / 36) };
  }).sort((a, b) => b.score - a.score || b.t - a.t).slice(0, max);
  return scored.map(({ title, source, url, t, tags, also, sources }) => ({ title, source, url, t, tags, also, sources: sources.slice(0, 4) }));
}
const QOK = /^[\p{L}\p{N} .,&'"()\-:+%]{2,110}$/u;
async function news(url, ctx) {
  const q = (url.searchParams.get('q') || '').trim();
  if (!QOK.test(q)) return json({ ok: false, error: 'give a short search phrase' }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null; const key = new Request(`https://tripwire.internal/__news_v1/${encodeURIComponent(q.toLowerCase())}`);
  const H1 = { 'cache-control': 'public, max-age=900, s-maxage=3600' };
  try {
    const hit = cache && await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...H, ...H1 } });
    // Google News first; if it refuses or fails (it may refuse a datacentre address), Bing News with the same words.
    const days = Number(q.match(/when:(\d+)d/)?.[1] ?? 14); const plain = q.replace(/\s*when:\d+d/g, '').trim(); const tried = [];
    const sources = [['google', `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`], ['bing', `https://www.bing.com/news/search?q=${encodeURIComponent(plain)}&format=rss&setmkt=en-IN`]];
    for (const [via, u] of sources) {
      try {
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/rss+xml,text/xml' }, signal: AbortSignal.timeout(9000) });
        if (!r.ok) { tried.push(`${via} ${r.status}`); continue; }
        const items = parseNews(await r.text(), Date.now(), 8, days + 1);
        if (!items.length && via === 'google') { tried.push('google no items'); continue; }
        const res = json({ ok: true, fetched_at: new Date().toISOString(), q, via, items }, 200, H1);
        if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
        return res;
      } catch { tried.push(`${via} failed`); }
    }
    return json({ ok: false, error: `the news sources did not answer (${tried.join(', ')})` }, 502);
  } catch { return json({ ok: false, error: 'the news source did not answer' }, 502); }
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
    if (url.pathname === '/api/ledger' || url.pathname === '/api/ledger/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return ledger(ctx);
    }
    if (url.pathname === '/api/intraday' || url.pathname === '/api/intraday/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      const list = [...new Set((url.searchParams.get('s') || '').toUpperCase().split(',').map((x) => x.trim()).filter(Boolean))];
      if (!list.length || list.length > MAX_QUOTES || !list.every((s) => SYM.test(s))) return json({ ok: false, error: `give 1 to ${MAX_QUOTES} valid symbols` }, 400);
      return quotes(list, (s) => `${s}.NS`, ctx);
    }
    if (url.pathname === '/api/pulse' || url.pathname === '/api/pulse/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return quotes(Object.keys(INDICES), (s) => INDICES[s], ctx);
    }
    if (url.pathname === '/api/macro' || url.pathname === '/api/macro/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return quotes(Object.keys(MACRO), (s) => MACRO[s], ctx);
    }
    if (url.pathname === '/api/news' || url.pathname === '/api/news/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return news(url, ctx);
    }
    if (url.pathname === '/api/factors' || url.pathname === '/api/factors/') {
      if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 405);
      return factors(ctx);
    }
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
