// Rulebook Worker: static assets plus two routes. POST /api/subscribe stores an email and consent in a SQLite Durable Object; GET /api/health.
// No prices, no accounts, no tracking. Nothing is sent by email from here. Admin export needs the ADMIN_TOKEN secret and is off without it.
import { DurableObject } from 'cloudflare:workers';
const SYM = /^[A-Z0-9&-]{1,20}$/;
export const INDEX = { NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', SENSEX: '^BSESN', NIFTYIT: '^CNXIT', NIFTYPHARMA: '^CNXPHARMA', INDIAVIX: '^INDIAVIX',
  /* sector indices for the home live board; an unrecognised ticker simply comes back missing and its tile shows a dash */
  NIFTYFIN: '^CNXFIN', NIFTYAUTO: '^CNXAUTO', NIFTYFMCG: '^CNXFMCG', NIFTYMETAL: '^CNXMETAL', NIFTYENERGY: '^CNXENERGY', NIFTYREALTY: '^CNXREALTY', NIFTYINFRA: '^CNXINFRA' };
export const yahooSymbol = (s) => (INDEX[s] ?? (SYM.test(s) ? `${s}.NS` : null));
/** Pure. One quote from Yahoo's chart payload; null when any required field is missing (a missing price is never replaced by a guess). */
export function parseQuote(j) {
  const m = j?.chart?.result?.[0]?.meta; if (!m || typeof m.regularMarketPrice !== 'number') return null; const n = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return { px: m.regularMarketPrice, prev: n(m.chartPreviousClose) ?? n(m.previousClose), t: n(m.regularMarketTime), hi: n(m.regularMarketDayHigh), lo: n(m.regularMarketDayLow) };
}
/** Pure. Daily candles as [{t: 'YYYY-MM-DD' (India date), o, h, l, c, v (volume or null)}]. A day missing any of the four prices is dropped, never filled. */
export function parseChart(j) {
  const r = j?.chart?.result?.[0]; const ts = r?.timestamp, q = r?.indicators?.quote?.[0]; if (!Array.isArray(ts) || !q || !Array.isArray(q.close)) return [];
  const ok = (x) => typeof x === 'number' && Number.isFinite(x); const rd = (x) => Math.round(x * 100) / 100; const out = [];
  for (let i = 0; i < ts.length; i++) { const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close[i]; if (ok(o) && ok(h) && ok(l) && ok(c)) out.push({ t: new Date((ts[i] + 19800) * 1000).toISOString().slice(0, 10), o: rd(o), h: rd(h), l: rd(l), c: rd(c), v: ok(q.volume?.[i]) ? Math.round(q.volume[i]) : null }); } return out;
}
async function yahoo(ysym, range, interval, ttl) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?range=${range}&interval=${interval}&includePrePost=false`; const cache = caches.default, key = new Request(url);
  const hit = await cache.match(key); if (hit) return hit.json();
  // a hard deadline: the abort signal alone is not trusted to end a stalled connection, and an endpoint that hangs is worse than one that fails
  const res = await Promise.race([fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; rulebook-quotes/1.0)', accept: 'application/json' }, signal: AbortSignal.timeout(5000) }), new Promise((_, rej) => setTimeout(() => rej(new Error('upstream timeout')), 5500))]); if (!res.ok) throw new Error(`upstream ${res.status}`);
  const body = await res.text(); await cache.put(key, new Response(body, { headers: { 'cache-control': `public, max-age=${ttl}` } })); return JSON.parse(body);
}
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/, CONSENT = 'weekly-note-v1';
const SEC = { 'x-content-type-options': 'nosniff', 'strict-transport-security': 'max-age=31536000; includeSubDomains', 'cross-origin-opener-policy': 'same-origin', 'cache-control': 'no-store' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...SEC } });
export class Subscribers extends DurableObject {
  constructor(ctx, env) { super(ctx, env); ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS subs (email TEXT PRIMARY KEY, consent TEXT NOT NULL, at TEXT NOT NULL)'); }
  add(email, consent, at) { this.ctx.storage.sql.exec('INSERT OR IGNORE INTO subs (email, consent, at) VALUES (?, ?, ?)', email, consent, at); return true; }
  all() { return this.ctx.storage.sql.exec('SELECT email, consent, at FROM subs ORDER BY at').toArray(); }
  restore(rows) { let n = 0; for (const r of rows) { this.ctx.storage.sql.exec('INSERT OR IGNORE INTO subs (email, consent, at) VALUES (?, ?, ?)', r.email, r.consent, r.at); n++; } return n; }
  remove(email) { this.ctx.storage.sql.exec('DELETE FROM subs WHERE email = ?', email); return true; }
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return json({ ok: true, at: new Date().toISOString() });
    if (url.pathname === '/api/subscribe' && req.method === 'POST') {
      const origin = req.headers.get('origin'); if (origin && new URL(origin).host !== url.host) return json({ error: 'Not allowed.' }, 403);
      if (env.SUBSCRIBE_LIMIT) { const ip = req.headers.get('cf-connecting-ip') || 'x'; const { success } = await env.SUBSCRIBE_LIMIT.limit({ key: ip }); if (!success) return json({ error: 'Too many tries. Wait a minute.' }, 429); }
      let form; try { form = await req.formData(); } catch { return json({ error: 'That did not look like a form.' }, 400); }
      const wantsHtml = (req.headers.get('accept') || '').includes('text/html'); const done = () => (wantsHtml ? new Response(null, { status: 303, headers: { location: '/?subscribed=1#join', ...SEC } }) : json({ ok: true }));
      if (String(form.get('website') || '')) return done();                                  // honeypot: look successful, store nothing
      const email = String(form.get('email') || '').trim().toLowerCase();
      if (!EMAIL.test(email) || email.length > 254) return json({ error: 'That email address does not look right.' }, 400);
      if (form.get('consent') !== CONSENT) return json({ error: 'Consent is needed to join the list.' }, 400);
      await env.SUBSCRIBERS.get(env.SUBSCRIBERS.idFromName('main')).add(email, CONSENT, new Date().toISOString()); return done();
    }
    if (url.pathname === '/api/subscribers' && env.ADMIN_TOKEN) {                           // owner export and deletion on request; off unless the secret is set
      const given = req.headers.get('authorization') || ''; if (given.length !== env.ADMIN_TOKEN.length + 7 || given !== 'Bearer ' + env.ADMIN_TOKEN) return json({ error: 'No.' }, 401);
      const stub = env.SUBSCRIBERS.get(env.SUBSCRIBERS.idFromName('main')); if (req.method === 'DELETE') { await stub.remove(url.searchParams.get('email') || ''); return json({ ok: true }); }
      if (req.method === 'PUT') { let b; try { b = await req.json(); } catch { return json({ error: 'Bad JSON.' }, 400); } const rows = Array.isArray(b?.rows) ? b.rows : []; if (rows.length > 20000 || !rows.every((r) => typeof r?.email === 'string' && EMAIL.test(r.email) && r.email.length <= 254 && r.consent === CONSENT && typeof r.at === 'string')) return json({ error: 'Rows rejected: every row needs a valid email, the current consent text and a time.' }, 400); return json({ ok: true, restored: await stub.restore(rows) }); }
      return json({ rows: await stub.all() });
    }
    if (url.pathname === '/api/quotes' || url.pathname === '/api/chart') {
      if (env.QUOTE_LIMIT) { const ip = req.headers.get('cf-connecting-ip') || 'x'; const { success } = await env.QUOTE_LIMIT.limit({ key: ip }); if (!success) return json({ error: 'Too many requests.' }, 429); }
      const q = url.searchParams.get('s') || ''; if (q.length > 800) return json({ error: 'Too long.' }, 400);
      if (url.pathname === '/api/chart') { const y = yahooSymbol(q.toUpperCase()); if (!y) return json({ error: 'Bad symbol.' }, 400); try { return json({ ok: true, source: 'Yahoo Finance, delayed and unofficial', points: parseChart(await yahoo(y, 'max', '1d', 900)) }); } catch (e) { return json({ ok: false, error: 'Upstream unavailable.' }, 502); } }
      const syms = [...new Set(q.toUpperCase().split(',').map((x) => x.trim()).filter(Boolean))]; if (!syms.length || syms.length > 40 || syms.some((x) => !yahooSymbol(x))) return json({ error: 'Between 1 and 40 valid symbols.' }, 400);
      const got = await Promise.allSettled(syms.map(async (x) => [x, parseQuote(await yahoo(yahooSymbol(x), '1d', '1m', 10))])); const quotes = {}, missing = [];
      got.forEach((g, i) => { if (g.status === 'fulfilled' && g.value[1]) quotes[syms[i]] = g.value[1]; else missing.push(syms[i]); });
      if (!Object.keys(quotes).length) return json({ ok: false, error: 'No quotes available from the upstream source.', missing }, 502);
      return json({ ok: true, fetched_at: new Date().toISOString(), source: 'Yahoo Finance, delayed and unofficial', quotes, missing });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    return env.ASSETS.fetch(req);
  },
};
