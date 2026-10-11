// alpha.askakshay.com — one Worker:
//   /data/<feed>.json  cached read-through to the same feeds the old Signal, Vision and Gems read
//   /api/quotes        live prices from Yahoo, cached 5 minutes
//   everything else    the static export in ./out
//   signal. / vision. / gems.  permanent redirect to alpha.

const RAW = 'https://raw.githubusercontent.com/caakshayk1-boop/trading-dashboard/main/docs';
const SIGNAL_RAW = 'https://raw.githubusercontent.com/caakshayk1-boop/signal/main/public';

// Allow-list: a request can only ever reach one of these URLs.
const FEEDS = {
  screen: `${RAW}/screen.json`,
  'screen-detail': `${RAW}/screen-detail.json`,
  pulse: `${RAW}/pulse.json`,
  regime: `${RAW}/regime.json`,
  barometer: `${RAW}/barometer.json`,
  ipo: `${RAW}/ipo.json`,
  news: `${RAW}/news.json`,
  funds: `${RAW}/funds.json`,
  weekly_reads: `${RAW}/weekly_reads.json`,
  seasonality: `${RAW}/seasonality.json`,
  swot: `${RAW}/swot.json`,
  'data-health': `${RAW}/data-health.json`,
  institutional: `${SIGNAL_RAW}/institutional.json`,
};

const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
};

function withHeaders(res, extra = {}) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(k, v);
  return out;
}

function json(body, status = 200, cache = 'no-store') {
  return withHeaders(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
    }),
  );
}

async function feed(name) {
  const upstream = FEEDS[name];
  if (!upstream) return json({ ok: false, error: 'unknown feed' }, 404);
  try {
    const r = await fetch(upstream, { cf: { cacheTtl: 600, cacheEverything: true } });
    // A missing upstream file must not reach the browser as a 404 page named .json.
    if (!r.ok) return json({ ok: false, error: `upstream ${r.status}` }, 502);
    return withHeaders(
      new Response(r.body, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=300, s-maxage=600',
        },
      }),
    );
  } catch (e) {
    return json({ ok: false, error: `feed fetch failed: ${e.message}` }, 502);
  }
}

// [id, name, group, yahoo symbol, prefix, decimals]
const INSTRUMENTS = [
  ['nifty', 'Nifty 50', 'India', '^NSEI', '', 0],
  ['sensex', 'Sensex', 'India', '^BSESN', '', 0],
  ['banknifty', 'Nifty Bank', 'India', '^NSEBANK', '', 0],
  ['vix', 'India VIX', 'India', '^INDIAVIX', '', 2],
  ['it', 'Nifty IT', 'Sectors', '^CNXIT', '', 0],
  ['fmcg', 'Nifty FMCG', 'Sectors', '^CNXFMCG', '', 0],
  ['pharma', 'Nifty Pharma', 'Sectors', '^CNXPHARMA', '', 0],
  ['auto', 'Nifty Auto', 'Sectors', '^CNXAUTO', '', 0],
  ['metal', 'Nifty Metal', 'Sectors', '^CNXMETAL', '', 0],
  ['energy', 'Nifty Energy', 'Sectors', '^CNXENERGY', '', 0],
  ['realty', 'Nifty Realty', 'Sectors', '^CNXREALTY', '', 0],
  ['psubank', 'Nifty PSU Bank', 'Sectors', '^CNXPSUBANK', '', 0],
  ['infra', 'Nifty Infra', 'Sectors', '^CNXINFRA', '', 0],
  ['media', 'Nifty Media', 'Sectors', '^CNXMEDIA', '', 0],
  ['spx', 'S&P 500', 'World', '^GSPC', '', 0],
  ['ndx', 'Nasdaq', 'World', '^IXIC', '', 0],
  ['dji', 'Dow Jones', 'World', '^DJI', '', 0],
  ['ftse', 'FTSE 100', 'World', '^FTSE', '', 0],
  ['dax', 'DAX', 'World', '^GDAXI', '', 0],
  ['n225', 'Nikkei 225', 'World', '^N225', '', 0],
  ['hsi', 'Hang Seng', 'World', '^HSI', '', 0],
  ['gold', 'Gold (futures)', 'Commodities', 'GC=F', '$', 1],
  ['silver', 'Silver (futures)', 'Commodities', 'SI=F', '$', 2],
  ['crude', 'WTI crude', 'Commodities', 'CL=F', '$', 2],
  ['brent', 'Brent crude', 'Commodities', 'BZ=F', '$', 2],
  ['gas', 'Natural gas', 'Commodities', 'NG=F', '$', 3],
  ['copper', 'Copper', 'Commodities', 'HG=F', '$', 3],
  ['usdinr', 'USD/INR', 'Currency', 'USDINR=X', '₹', 2],
  ['eurinr', 'EUR/INR', 'Currency', 'EURINR=X', '₹', 2],
  ['dxy', 'Dollar index', 'Currency', 'DX-Y.NYB', '', 2],
  ['us10y', 'US 10-year yield', 'Rates', '^TNX', '', 3],
  ['btc', 'Bitcoin', 'Crypto', 'BTC-USD', '$', 0],
  ['eth', 'Ethereum', 'Crypto', 'ETH-USD', '$', 0],
];

const dayKey = (t) => new Date(t * 1000).toISOString().slice(0, 10);

async function quote([id, name, group, symbol, prefix, dp]) {
  const base = { id, name, group, symbol, prefix, dp };
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(7000) },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const res = (await r.json())?.chart?.result?.[0];
    const meta = res?.meta;
    const ts = res?.timestamp || [];
    const cl = res?.indicators?.quote?.[0]?.close || [];
    // pair timestamps with closes, dropping the nulls Yahoo leaves for holidays
    const pts = ts.map((t, i) => [t, cl[i]]).filter(([, c]) => typeof c === 'number' && Number.isFinite(c));
    const price = Number(meta?.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0 || pts.length < 1) throw new Error('no usable price');
    // chartPreviousClose over a 1-month range is the close a MONTH ago, not yesterday's.
    // Yesterday's close is the second-to-last bar while today's bar is still forming,
    // otherwise the last bar.
    const last = pts[pts.length - 1];
    const today = meta?.regularMarketTime ? dayKey(meta.regularMarketTime) : null;
    let prev;
    if (pts.length >= 2) prev = today && dayKey(last[0]) === today ? pts[pts.length - 2][1] : last[1];
    // Some sector indices come back with a single bar. With one bar in the window, the close
    // before that window IS the previous session, so chartPreviousClose is right here (and only here).
    else prev = Number(meta?.previousClose ?? meta?.chartPreviousClose);
    if (!Number.isFinite(prev) || prev <= 0) throw new Error('no previous close');
    return {
      ...base,
      price,
      prev,
      pct: Math.round(((price - prev) / prev) * 10000) / 100,
      series: pts.length >= 2 ? pts.map(([, c]) => Math.round(c * 1000) / 1000) : [],
      state: meta?.marketState || null,
      at: meta?.regularMarketTime || null,
    };
  } catch (e) {
    // Omitted by the client, never drawn as 0%: a flat market and a dead feed must not look alike.
    return { ...base, price: null, error: e.message };
  }
}

async function quotes(ctx) {
  const cache = caches.default;
  const key = new Request('https://alpha.askakshay.com/__quotes_v2');
  const hit = await cache.match(key);
  if (hit) return withHeaders(hit);
  const list = await Promise.all(INSTRUMENTS.map(quote));
  const live = list.filter((q) => q.price !== null).length;
  const res = json({ ok: live > 0, fetched_at: new Date().toISOString(), live, total: list.length, quotes: list }, 200, 'public, max-age=120, s-maxage=300');
  if (live > 0) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// ── live IPO subscription book ───────────────────────────────────────────
// The mirrored ipo.json is up to a week old and an IPO book moves fastest on its last day. NSE
// publishes the live book; one row per active issue, cached 15 minutes at the edge.
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.nseindia.com/',
};
const nz = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const shortCat = (c) => {
  const s = String(c || '').trim();
  if (/qualified institutional/i.test(s)) return 'QIB';
  if (/^non\s*institutional\s*investors$/i.test(s)) return 'NII';
  if (/retail/i.test(s)) return 'Retail';
  if (/^employee/i.test(s)) return 'Employees';
  if (/^total$/i.test(s)) return 'Total';
  return null;
};

async function ipoLive() {
  try {
    const r = await fetch('https://www.nseindia.com/api/ipo-current-issue', { headers: NSE_HEADERS, signal: AbortSignal.timeout(9000) });
    if (!r.ok) throw new Error(`NSE HTTP ${r.status}`);
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error('NSE sent no list');
    const issues = rows.map((x) => ({
      symbol: String(x.symbol || '').trim().toUpperCase(),
      company: x.companyName || null,
      status: x.status || null,
      price_band: x.issuePrice || null,
      opens: x.issueStartDate || null,
      closes: x.issueEndDate || null,
      total_x: nz(x.noOfTime),
    })).filter((x) => x.symbol);
    // per-category split: one detail call per issue
    await Promise.all(issues.map(async (e) => {
      try {
        const d = await fetch(`https://www.nseindia.com/api/ipo-detail?symbol=${encodeURIComponent(e.symbol)}&series=EQ`, { headers: NSE_HEADERS, signal: AbortSignal.timeout(7000) });
        if (!d.ok) return;
        const j = await d.json();
        e.categories = (j.bidDetails || [])
          .map((b) => ({ cat: shortCat(b.category), x: nz(b.noOfTime) }))
          .filter((b) => b.cat && b.cat !== 'Total' && b.x !== null);
      } catch { /* an issue without a split keeps its headline multiple */ }
    }));
    return withHeaders(new Response(JSON.stringify({ ok: true, at: new Date().toISOString(), source: 'NSE', issues }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900' },
    }));
  } catch (e) {
    // 200 with ok:false: the page keeps working on the mirrored figures and says which it shows.
    return json({ ok: false, error: String(e.message || e), issues: [] }, 200, 'public, max-age=60');
  }
}

// ── live prices for specific NSE stocks ─────────────────────────────────
// /api/px?s=TCS,INFY  →  { quotes: { TCS: { price, prev, pct, state, at } } }
// Up to 40 symbols, cached 60 seconds at the edge. A symbol that does not answer is simply absent: the page then shows
// the last close it already has, labelled as such, never a zero.
async function px(url, ctx) {
  const syms = Array.from(new Set((url.searchParams.get('s') || '').toUpperCase().split(',').map((x) => x.trim()).filter((x) => /^[A-Z0-9&-]{1,20}$/.test(x)))).slice(0, 40).sort();
  if (!syms.length) return json({ ok: false, error: 'no valid symbols', quotes: {} }, 400);
  const cache = caches.default;
  const key = new Request(`https://alpha.askakshay.com/__px_v1/${syms.join(',')}`);
  const hit = await cache.match(key);
  if (hit) return withHeaders(hit);
  const quotes = {};
  await Promise.all(syms.map(async (sym) => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym + '.NS')}?range=1d&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) return;
      const meta = (await r.json())?.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice);
      const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose);
      if (!(price > 0) || !(prev > 0)) return;
      quotes[sym] = { price, prev, pct: Math.round(((price - prev) / prev) * 10000) / 100, state: meta?.marketState || null, at: meta?.regularMarketTime || null };
    } catch { /* absent, not zero */ }
  }));
  const res = json({ ok: Object.keys(quotes).length > 0, fetched_at: new Date().toISOString(), requested: syms.length, live: Object.keys(quotes).length, quotes }, 200, 'public, max-age=30, s-maxage=60');
  if (Object.keys(quotes).length) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = (request.headers.get('host') || url.hostname).toLowerCase();

    // The three old sites are one site now.
    if (/^(signal|vision|gems)\./.test(host)) {
      return Response.redirect('https://alpha.askakshay.com/', 301);
    }

    if (url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')) {
      return feed(url.pathname.slice('/data/'.length, -'.json'.length));
    }
    if (url.pathname === '/api/px' || url.pathname === '/api/px/') {
      return px(url, ctx);
    }
    if (url.pathname === '/api/ipo-live' || url.pathname === '/api/ipo-live/') {
      return ipoLive();
    }
    if (url.pathname === '/api/quotes' || url.pathname === '/api/quotes/') {
      return quotes(ctx);
    }
    return withHeaders(await env.ASSETS.fetch(request));
  },
};
