// Alerts between the briefs: Tripwire ledger events, Alpha gate flips, and your watchlist. Pure functions (node --test runs them).
// A snapshot is compared with the feed; with no snapshot yet the first run only records a baseline and says nothing.
import { esc } from './commands.js';
import { localParts } from './news.js';
import { TZ } from './briefs.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const n = (v, d = 2) => (isNum(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: d }) : 'n/a');
const sgn = (p) => (isNum(p) ? `${p >= 0 ? '+' : ''}${p.toFixed(2)}%` : 'n/a');

export const MAX_ALERT_MSGS_PER_HOUR = 6;
export const MOVE_PCT = 3;
export const RSI_HI = 70;
export const RSI_LO = 30;

const minutes = (nowMs) => { const p = localParts(nowMs, TZ); return p.hour * 60 + p.minute; };
const weekday = (nowMs) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' }).format(new Date(nowMs));
/** 23:00 to 07:30 Malaysia time: alerts wait for the morning. */
export const isQuiet = (nowMs) => { const m = minutes(nowMs); return m >= 23 * 60 || m < 7 * 60 + 30; };
/** Indian cash market: 09:15-15:30 IST is 11:45-18:00 Malaysia time, Mon-Fri. Price alerts only run inside it. */
export const isMarketHours = (nowMs) => { const d = weekday(nowMs); const m = minutes(nowMs); return d !== 'Sat' && d !== 'Sun' && m >= 11 * 60 + 45 && m < 18 * 60; };

/** Tripwire ledger -> a small comparable snapshot. */
export function ledgerSnap(ledger) {
  const l = ledger && ledger.ledger;
  if (!l || !Array.isArray(l.picks)) return null;
  const out = {};
  for (const [id, o] of Object.entries(l.outcomes || {})) out[id] = [o && o.status, o && o.t1Hit ? 1 : 0];
  return { ids: l.picks.map((p) => p.id), out };
}

export function ledgerAlerts(prev, ledger) {
  const snap = ledgerSnap(ledger);
  if (!snap || !prev) return { lines: [], snap };
  const l = ledger.ledger;
  const byId = new Map(l.picks.map((p) => [p.id, p]));
  const known = new Set(prev.ids);
  const lines = [];
  const fresh = l.picks.filter((p) => !known.has(p.id));
  if (fresh.length && fresh.length <= 4) for (const p of fresh) lines.push(`Tripwire new pick: <b>${esc(p.sym)}</b> (${esc(p.engine)} rank ${n(p.rank, 0)}, score ${n(p.score, 0)})`);
  else if (fresh.length) {
    const by = {};
    for (const p of fresh) by[p.engine] = (by[p.engine] || 0) + 1;
    const top = fresh.filter((p) => p.rank === 1).map((p) => esc(p.sym)).slice(0, 3);
    lines.push(`Tripwire ${fresh.length} new picks (${Object.entries(by).map(([k, v]) => `${esc(k)} ${v}`).join(', ')})${top.length ? `; rank 1: ${top.join(', ')}` : ''}`);
  }
  for (const [id, o] of Object.entries(l.outcomes || {})) {
    const pv = prev.out[id];
    if (!pv || !o) continue;
    const p = byId.get(id);
    const name = p ? `<b>${esc(p.sym)}</b> (${esc(p.engine)}, picked ${esc(p.asOf)})` : esc(id);
    if (o.status === 'closed' && pv[0] !== 'closed') lines.push(`Tripwire closed: ${name} · ${esc(o.reason || 'n/a')} · ${sgn(o.pct)} · ${n(o.r, 1)} R`);
    else if (o.status === 'open' && o.t1Hit && !pv[1]) lines.push(`Tripwire target 1 hit: ${name} · ${sgn(o.pct)} since entry ${n(o.entry)} · ${n(o.r, 1)} R${p && isNum(p.stop) ? ` · stop ${n(p.stop)}` : ''}`);
  }
  return { lines, snap };
}

export function gateSnap(signals) {
  if (!signals || !signals.gate) return null;
  const list = Array.isArray(signals.signals) ? signals.signals : [];
  return { on: signals.gate.on === true ? true : signals.gate.on === false ? false : null, syms: list.map((x) => String(x.sym || x.symbol || x.s || '').toUpperCase()).filter(Boolean) };
}

export function gateAlerts(prev, signals) {
  const snap = gateSnap(signals);
  if (!snap || !prev) return { lines: [], snap };
  const lines = [];
  const word = (v) => (v === true ? 'ON' : v === false ? 'OFF' : 'n/a');
  if (prev.on !== snap.on) lines.push(`Alpha gate flipped ${word(prev.on)} → ${word(snap.on)}`);
  const added = snap.syms.filter((x) => !prev.syms.includes(x));
  const gone = prev.syms.filter((x) => !snap.syms.includes(x));
  if (added.length) lines.push(`Alpha new signal: ${added.map(esc).join(', ')}`);
  if (gone.length) lines.push(`Alpha signal no longer open: ${gone.map(esc).join(', ')}`);
  if (lines.length && signals.alertable !== true) lines.push('<i>The hub says its own alerts are off, so treat this as research, not a trade call.</i>');
  return { lines, snap };
}

/** Watchlist: price move, RSI crossing, new stories. State in/out is plain data so the Worker can store it. */
export function watchAlerts({ watch, tick, rsi, events, alerted = {}, wrsi = {}, nowMs, market }) {
  const lines = [];
  const nextAlerted = { ...alerted };
  const nextRsi = { ...wrsi };
  const day = localParts(nowMs, TZ).date;
  const newsIds = [];
  for (const w of watch) {
    const sym = w.sym;
    const q = tick && tick.quotes && tick.quotes[sym];
    if (market && q && q.live === true && isNum(q.px) && isNum(q.prev) && q.prev !== 0) {
      const p = ((q.px - q.prev) / q.prev) * 100;
      const key = `mv:${sym}:${day}:${p > 0 ? 'u' : 'd'}`;
      if (Math.abs(p) >= MOVE_PCT && !nextAlerted[key]) { lines.push(`Watch: <b>${esc(sym)}</b> ${sgn(p)} vs previous close (${n(q.px)})`); nextAlerted[key] = nowMs; }
    }
    const r = rsi && rsi.rows && rsi.rows[sym];
    if (market && Array.isArray(r) && isNum(r[0])) {
      const was = nextRsi[sym];
      if (isNum(was)) {
        if (was < RSI_HI && r[0] >= RSI_HI) lines.push(`Watch: <b>${esc(sym)}</b> daily RSI 14 crossed above ${RSI_HI} (${n(r[0], 1)})`);
        if (was > RSI_LO && r[0] <= RSI_LO) lines.push(`Watch: <b>${esc(sym)}</b> daily RSI 14 crossed below ${RSI_LO} (${n(r[0], 1)})`);
      }
      nextRsi[sym] = r[0];
    }
  }
  const bySym = new Map(watch.map((w) => [w.sym, w]));
  let stories = 0;
  for (const e of Array.isArray(events) ? events : []) {
    const key = `ev:${e && e.eventClusterId}`;
    if (!e || !e.headline || nextAlerted[key] || !Array.isArray(e.entities)) continue;
    const hit = e.entities.map((x) => bySym.get(String((x && x.sym) || '').toUpperCase())).find(Boolean);
    if (!hit || !(Date.parse(e.publishedAt) >= hit.since)) continue;
    nextAlerted[key] = nowMs;
    newsIds.push(e.eventClusterId);
    if (stories++ < 5) lines.push(`Watch news on <b>${esc(hit.sym)}</b>: ${esc(e.headline)} <i>(${esc(e.sourceTitle || 'source n/a')})</i>`);
  }
  for (const k of Object.keys(nextAlerted)) if (nextAlerted[k] < nowMs - 14 * 864e5) delete nextAlerted[k];
  return { lines, alerted: nextAlerted, wrsi: nextRsi, newsIds };
}

/** One message per check, so five alerts in one tick are one ping. */
export function alertMessage(lines, nowMs) {
  const when = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(nowMs)).replace(',', '');
  const shown = lines.slice(0, 8);
  const more = lines.length > shown.length ? [`+${lines.length - shown.length} more`] : [];
  return `<b>Alerts (${lines.length}) · ${esc(when)} MYT</b>\n${[...shown, ...more].map((x) => (x.startsWith('<i>') || x.startsWith('+') ? x : `• ${x}`)).join('\n')}\n<i>Paper research, educational, not advice.</i>`;
}
