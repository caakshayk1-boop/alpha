// /stock SYMBOL: one full brief built from what Tripwire publishes for a stock (price, daily bars, RSI, its paper-ledger picks, news),
// plus a one-line fundamentals row from the Alpha hub. Pure functions; a missing value is "n/a", never zero.
import { esc, SYMBOL, SOURCES } from './commands.js';
import { NEWS_URL } from './news.js';
import { newsLines } from './briefs.js';
import { localParts } from './news.js';

const TW = 'https://tripwire.askakshay.com';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const n = (v, d = 2) => (isNum(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: d }) : 'n/a');
const sgn = (p) => (isNum(p) ? `${p >= 0 ? '+' : ''}${p.toFixed(2)}%` : 'n/a');
const chg = (a, b) => (isNum(a) && isNum(b) && b !== 0 ? ((a - b) / b) * 100 : null);
const avg = (arr, k) => (arr.length >= k ? arr.slice(-k).reduce((x, y) => x + y, 0) / k : null);

/** What the daily bars say. Only what the bars can support: 127 sessions is not enough for a 200-day average, so none is shown. */
export function trend(bars) {
  const c = bars && Array.isArray(bars.c) ? bars.c.filter(isNum) : [];
  if (c.length < 6) return null;
  const last = c[c.length - 1];
  const hi = Math.max(...(bars.h || []).filter(isNum), ...c);
  const lo = Math.min(...(bars.l || []).filter(isNum), ...c);
  return {
    sessions: c.length, last, hi, lo,
    fromHigh: chg(last, hi), fromLow: chg(last, lo),
    w1: c.length > 5 ? chg(last, c[c.length - 6]) : null,
    m1: c.length > 21 ? chg(last, c[c.length - 22]) : null,
    sma20: avg(c, 20), sma50: avg(c, 50),
  };
}

const when = (pt) => { if (!isNum(pt)) return 'n/a'; const p = localParts(pt * 1000, 'Asia/Kolkata'); return `${p.date} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} IST`; };

function ledgerLines(ledger, sym) {
  const l = ledger && ledger.ledger;
  if (!l || !Array.isArray(l.picks)) return null;
  const mine = l.picks.filter((p) => p && String(p.sym).toUpperCase() === sym).sort((a, b) => String(b.asOf).localeCompare(String(a.asOf))).slice(0, 3);
  if (!mine.length) return [];
  return mine.map((p) => {
    const o = (l.outcomes || {})[p.id] || {};
    const state = o.status ? esc(o.status) : 'n/a';
    return `• ${esc(p.engine)} · picked ${esc(p.asOf)} (rank ${n(p.rank, 0)}, score ${n(p.score, 0)}) · ${state} · ${sgn(o.pct)} since entry ${n(o.entry)} · ${n(o.r, 1)} R · stop ${n(p.stop)}${o.t1Hit ? ' · target 1 hit' : ''}`;
  });
}

/** Stories naming this stock from the last 7 days, newest first, one per headline. */
export function storiesFor(events, sym, nowMs) {
  const seen = new Set();
  return (Array.isArray(events) ? events : [])
    .filter((e) => e && e.headline && Date.parse(e.publishedAt) > nowMs - 7 * 864e5 && Array.isArray(e.entities) && e.entities.some((x) => x && String(x.sym).toUpperCase() === sym))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((e) => { const k = e.headline.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 3);
}

export function composeStock(sym, f, nowMs = Date.now()) {
  const q = f.tick && f.tick.quotes && f.tick.quotes[sym];
  const bars = f.bars && f.bars.bars && f.bars.bars[sym];
  const row = f.company && f.company.row;
  const rsi = f.rsi && f.rsi.rows && f.rsi.rows[sym];
  if (!q && !bars && !row) return null;
  const name = (row && row.name) || (f.events || []).flatMap((e) => e.entities || []).find((x) => x && String(x.sym).toUpperCase() === sym)?.name || sym;
  const out = [`<b>${esc(sym)}</b>${name !== sym ? ` · ${esc(name)}` : ''}`];
  if (q) out.push(`Price ${n(q.px)} (${sgn(chg(q.px, q.prev))} vs ${n(q.prev)}) · ${q.live ? 'live' : 'not live'} · last tick ${esc(when(q.pt))}`);
  else out.push('Price n/a (Tripwire price feed has no quote for this symbol)');
  const t = trend(bars);
  if (t) {
    out.push(`Last ${t.sessions} sessions: low ${n(t.lo)} · high ${n(t.hi)} · now ${sgn(t.fromHigh)} from the high`);
    out.push(`1 week ${sgn(t.w1)} · 1 month ${sgn(t.m1)} · 20-day avg ${n(t.sma20)} (${t.sma20 === null ? 'n/a' : t.last >= t.sma20 ? 'above' : 'below'}) · 50-day avg ${n(t.sma50)} (${t.sma50 === null ? 'n/a' : t.last >= t.sma50 ? 'above' : 'below'})`);
  }
  out.push(Array.isArray(rsi) ? `RSI 14: daily ${n(rsi[0], 1)} · weekly ${n(rsi[1], 1)} · monthly ${n(rsi[2], 1)}` : 'RSI 14: n/a');
  const lg = ledgerLines(f.ledger, sym);
  out.push('', '<b>Tripwire paper ledger</b>');
  if (lg === null) out.push('n/a (ledger unavailable)'); else if (!lg.length) out.push('Not picked by any Tripwire engine yet.'); else out.push(...lg);
  const st = storiesFor(f.events, sym, nowMs);
  out.push('', '<b>News, last 7 days</b>');
  if (st.length) out.push(...newsLines(st)); else out.push(f.events && f.events.length ? 'No stories naming this stock.' : 'n/a (news feed unavailable)');
  if (row) out.push('', `<b>Fundamentals</b> (Alpha hub, ${esc(row.fy || 'FY n/a')}): ${esc(row.sector || 'n/a')} · ${esc(row.tier || 'n/a')} · ROCE ${n(row.roce, 1)}% · ROE ${n(row.roe, 1)}% · D/E ${n(row.de)} · Rev CAGR ${n(row.rev_cagr, 1)}%`);
  out.push('', '<i>Tripwire is a paper ledger and its prices are delayed. Educational, not advice.</i>');
  return out.join('\n');
}

/** deps.getJSON(url). Each feed may fail on its own; the brief says n/a for that part. */
export async function stockBrief(deps, arg, nowMs = Date.now()) {
  const sym = String(arg || '').trim().toUpperCase();
  if (!SYMBOL.test(sym)) return 'Usage: /stock SYMBOL, the NSE ticker (e.g. /stock INFY or /stock TCS)';
  const get = async (u) => { try { return await deps.getJSON(u); } catch { return null; } };
  const [tick, bars, rsi, ledger, news, company] = await Promise.all([
    get(`${TW}/api/tick?s=${encodeURIComponent(sym)}`), get(`${TW}/api/bars?s=${encodeURIComponent(sym)}`), get(`${TW}/api/rsi`),
    get(SOURCES.ledger), get(NEWS_URL), get(SOURCES.company(sym)),
  ]);
  const text = composeStock(sym, { tick, bars, rsi, ledger, events: news && news.events, company }, nowMs);
  return text || `No data for ${esc(sym)}. Use the NSE ticker, for example /stock INFY.`;
}
