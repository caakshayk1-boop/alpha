// Owner commands for the watchlist and reminders. Pure: deps = { getJSON, watch: {list, set}, remind: {list, set} } (set replaces the whole list).
// Times are Malaysia time (UTC+8, no daylight saving).
import { esc, SYMBOL } from './commands.js';
import { localParts } from './news.js';
import { TZ } from './briefs.js';

const MAX_WATCH = 15;
const MAX_REMIND = 50;
const fmtAt = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)).replace(',', '') + ' MYT';

/** "18:00 text", "tomorrow 08:30 text", "2026-11-25 09:00 text" -> { at, text } or { error }. A time already past today means tomorrow. */
export function parseRemind(arg, nowMs) {
  const m = /^(?:(tomorrow)\s+|(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}):(\d{2})\s+([\s\S]+)$/i.exec(String(arg || '').trim());
  const usage = { error: 'Usage: /remind 18:00 text · /remind tomorrow 08:30 text · /remind 2026-11-25 09:00 text (Malaysia time)' };
  if (!m) return usage;
  const h = Number(m[3]);
  const mi = Number(m[4]);
  const text = m[5].trim();
  if (h > 23 || mi > 59) return usage;
  if (text.length > 300) return { error: 'Reminder too long (300 characters max).' };
  const today = localParts(nowMs, TZ).date;
  const base = (d) => { const [y, mo, da] = d.split('-').map(Number); return Date.UTC(y, mo - 1, da, h - 8, mi); };
  let at;
  if (m[2]) { at = base(m[2]); if (!(at > nowMs)) return { error: 'That date and time has already passed.' }; }
  else {
    at = base(today);
    if (m[1] || at <= nowMs) at += 864e5;
  }
  return { at, text };
}

export async function handleExtra(text, deps, nowMs = Date.now()) {
  const m = /^\/(watch|unwatch|watchlist|remind|reminders|unremind)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(String(text || '').trim());
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const arg = (m[2] || '').trim();
  if (cmd === 'watchlist' || (cmd === 'watch' && !arg)) {
    const w = await deps.watch.list();
    return w.length ? `<b>Watchlist (${w.length})</b>\n${w.map((x) => esc(x.sym)).join(', ')}\nAlerts: a move of 3% or more from the previous close, daily RSI crossing 70 or 30 (both only while the Indian market is open), and new stories. /unwatch SYMBOL removes one.` : 'Watchlist is empty. Add stocks with /watch INFY TCS';
  }
  if (cmd === 'watch') {
    const syms = [...new Set(arg.toUpperCase().split(/[\s,]+/).filter(Boolean))];
    if (!syms.length || syms.some((s) => !SYMBOL.test(s))) return 'Usage: /watch SYMBOL [SYMBOL ...], NSE tickers, e.g. /watch INFY TCS';
    const cur = await deps.watch.list();
    const fresh = syms.filter((s) => !cur.some((x) => x.sym === s));
    if (cur.length + fresh.length > MAX_WATCH) return `Watchlist is limited to ${MAX_WATCH} stocks. Remove one with /unwatch SYMBOL.`;
    let known = [];
    try { const t = await deps.getJSON(`https://tripwire.askakshay.com/api/tick?s=${fresh.map(encodeURIComponent).join(',')}`); known = Object.keys((t && t.quotes) || {}); } catch { return 'Could not check those symbols right now. Try again shortly.'; }
    const bad = fresh.filter((s) => !known.includes(s));
    const good = fresh.filter((s) => known.includes(s));
    if (good.length) await deps.watch.set([...cur, ...good.map((sym) => ({ sym, since: nowMs }))]);
    return [good.length ? `Watching: ${good.map(esc).join(', ')}. Alerts start from now.` : '', bad.length ? `Unknown on Tripwire: ${bad.map(esc).join(', ')} (use the NSE ticker).` : '', syms.length > fresh.length ? 'Already on the list: ' + syms.filter((s) => !fresh.includes(s)).map(esc).join(', ') : ''].filter(Boolean).join('\n');
  }
  if (cmd === 'unwatch') {
    const syms = arg.toUpperCase().split(/[\s,]+/).filter(Boolean);
    if (!syms.length) return 'Usage: /unwatch SYMBOL';
    const cur = await deps.watch.list();
    const next = cur.filter((x) => !syms.includes(x.sym));
    await deps.watch.set(next);
    return next.length === cur.length ? 'None of those were on the watchlist.' : `Removed. Watching ${next.length}.`;
  }
  if (cmd === 'remind') {
    const r = parseRemind(arg, nowMs);
    if (r.error) return r.error;
    const cur = await deps.remind.list();
    if (cur.length >= MAX_REMIND) return `You have ${MAX_REMIND} reminders already. Remove one with /unremind N.`;
    const next = [...cur, r].sort((a, b) => a.at - b.at);
    await deps.remind.set(next);
    return `Reminder ${next.indexOf(r) + 1} set for ${fmtAt(r.at)}: ${esc(r.text)}`;
  }
  if (cmd === 'reminders') {
    const cur = await deps.remind.list();
    return cur.length ? '<b>Reminders</b>\n' + cur.map((x, i) => `${i + 1}. ${fmtAt(x.at)} · ${esc(x.text)}`).join('\n') : 'No reminders. Set one with /remind 18:00 text';
  }
  const k = Number(arg);
  const cur = await deps.remind.list();
  if (!Number.isInteger(k) || k < 1 || k > cur.length) return 'Usage: /unremind N (see /reminders)';
  cur.splice(k - 1, 1);
  await deps.remind.set(cur);
  return `Removed reminder ${k}.`;
}

/** Reminders whose time has come, and the list that is left. */
export function dueReminders(list, nowMs) {
  return { due: list.filter((x) => x.at <= nowMs), rest: list.filter((x) => x.at > nowMs) };
}
