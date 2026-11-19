// Three weekday briefs in Malaysia time: 08:00 plan, 12:00 open check, 18:30 close scorecard.
// Pure functions (no Cloudflare imports) so node --test runs them. Rule: a missing value is "n/a", never zero, never guessed.
// Each brief says what CHANGED since the previous brief; sites with no change collapse into one line.
import { esc, SOURCES } from './commands.js';
import { rank, localParts } from './news.js';

export const TZ = 'Asia/Kuala_Lumpur';
export const SLOTS = [
  { id: 'morning', hour: 8, minute: 0, title: 'Morning plan' },
  { id: 'open', hour: 12, minute: 0, title: 'Open check' },
  { id: 'close', hour: 18, minute: 30, title: 'Close scorecard' },
  { id: 'weekly', hour: 9, minute: 0, title: 'Weekly review', days: 'sat' },
];
export const LINKS = [
  ['Tripwire', 'https://tripwire.askakshay.com'],
  ['Alpha', 'https://alpha.askakshay.com'],
  ['Rulebook', 'https://lockedfree.askakshay.com'],
  ['ApexPro', 'https://apexpro.askakshay.com'],
];
const IST = 'Asia/Kolkata';
const MAX_NEWS = 5;

const WINDOW_MIN = 60;
/** The cron fires every 5 minutes. A slot is due (Mon-Fri, or Saturday for the weekly review) for 60 minutes from its start, so a failed first send is retried on the next ticks.
 *  The key is claimed before sending, so a repeat tick after a successful send does nothing. */
export function dueSlot(nowMs, tz = TZ, slots = SLOTS) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  if (p.weekday === 'Sun') return null;
  const sat = p.weekday === 'Sat';
  const mins = Number(p.hour) * 60 + Number(p.minute);
  const slot = slots.find((s) => (s.days === 'sat') === sat && mins >= s.hour * 60 + s.minute && mins < s.hour * 60 + s.minute + WINDOW_MIN);
  return slot ? { slot, key: `${p.year}-${p.month}-${p.day}:${slot.id}` } : null;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const fmt = (v, d = 2) => (isNum(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: d }) : 'n/a');
const pctOf = (px, prev) => (isNum(px) && isNum(prev) && prev !== 0 ? ((px - prev) / prev) * 100 : null);
const sgn = (p) => (p === null ? 'n/a' : `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`);

/** Raw feeds in, small comparable state out. Any feed may be null (source down); its part stays null. */
export function digestFeeds(f, nowMs = Date.now()) {
  const st = { market: null, hub: null, tw: null, lf: null, apex: null, flows: null };
  const q = f.pulse && f.pulse.quotes;
  if (q) {
    const one = (k) => (q[k] ? { px: q[k].px, prev: q[k].prev, pct: pctOf(q[k].px, q[k].prev) } : null);
    const pt = q.NIFTY && isNum(q.NIFTY.pt) ? localParts(q.NIFTY.pt * 1000, IST).date : null;
    st.market = { nifty: one('NIFTY'), bank: one('BANKNIFTY'), vix: one('VIX'), lastDate: pt, todayIst: localParts(nowMs, IST).date };
  }
  const s = f.signals;
  if (s) {
    const g = s.gate || {};
    const list = Array.isArray(s.signals) ? s.signals : [];
    st.hub = {
      gateOn: g.on === true ? true : g.on === false ? false : null,
      passed: isNum(g.passed) ? g.passed : null, total: Array.isArray(g.checks) ? g.checks.length : null,
      dataThrough: s.data_through || null,
      syms: list.map((x) => String(x.sym || x.symbol || x.s || '').toUpperCase()).filter(Boolean),
      record: s.record || {}, alertable: s.alertable === true, why: typeof s.alert_why === 'string' ? s.alert_why : null,
    };
  }
  const l = f.ledger && f.ledger.ledger;
  if (l && Array.isArray(l.days) && l.days.length) {
    const last = l.days[l.days.length - 1];
    const open = Object.entries(l.outcomes || {}).filter(([, o]) => o && o.status === 'open');
    const moves = open.map(([, o]) => o.pct).filter(isNum);
    st.tw = {
      lastDay: last.asOf || null,
      picked: Object.values(last.engines || {}).reduce((a, e) => a + (isNum(e.picked) ? e.picked : 0), 0),
      open: open.length,
      avgPct: moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : null,
      openSyms: open.map(([k]) => String(k.split('|')[2] || '').toUpperCase()).filter(Boolean),
    };
  }
  const r = f.rulebook;
  if (r && Array.isArray(r.aggregates)) {
    const days = (r.book_days || []).filter((b) => b.screen_id === 'all');
    const book = days.reduce((a, b) => (!a || b.date >= a.date ? b : a), null);
    st.lf = {
      asOf: r.as_of || null,
      open: r.aggregates.reduce((a, x) => a + (isNum(x.n_open) ? x.n_open : 0), 0),
      closed: r.aggregates.reduce((a, x) => a + (isNum(x.n_closed) ? x.n_closed : 0), 0),
      equity: book && isNum(book.equity) ? book.equity : null,
      unreal: book && isNum(book.unrealised) ? book.unrealised : null,
    };
  }
  const hp = f.hubPulse;
  const sec = hp && (Array.isArray(hp.sectors_day) && hp.sectors_day.length ? hp.sectors_day : Array.isArray(hp.sectors) ? hp.sectors : []).filter((x) => x && isNum(x.median));
  if (hp && sec.length) {
    const sorted = [...sec].sort((a, b) => b.median - a.median);
    const b = hp.breadth || {};
    st.apex = {
      builtOn: hp.built_on || null,
      lead: { name: sorted[0].name, median: sorted[0].median },
      lag: { name: sorted[sorted.length - 1].name, median: sorted[sorted.length - 1].median },
      up: isNum(b.up) ? b.up : null, down: isNum(b.down) ? b.down : null, counted: isNum(b.counted) ? b.counted : null,
    };
  }
  const fl = {};
  const rows = f.fiidii && Array.isArray(f.fiidii.rows) ? f.fiidii.rows : [];
  const last = rows[rows.length - 1];
  if (last && last.fii && last.dii) fl.fii = { date: last.date, fii: last.fii.net, dii: last.dii.net };
  const b = f.breadth;
  if (b && isNum(b.up) && isNum(b.down)) fl.breadth = { asOf: b.as_of, up: b.up, down: b.down, mixed: b.mixed, n: b.n };
  const mq = f.macro && f.macro.quotes;
  if (mq) {
    const labels = [['BRENT', 'Brent', 2], ['GOLD', 'Gold', 1], ['BTC', 'BTC', 0], ['USDMYR', 'USD/MYR', 3]];
    fl.macro = labels.filter(([k]) => mq[k] && isNum(mq[k].px)).map(([k, label, d]) => ({ label, px: mq[k].px, d, pct: pctOf(mq[k].px, mq[k].prev), live: mq[k].live === true }));
  }
  if (fl.fii || fl.breadth || (fl.macro && fl.macro.length)) st.flows = fl;
  return st;
}

/** What gets stored between briefs: just enough to say what changed. */
export function snapshot(st, nowMs = Date.now()) {
  return {
    at: nowMs,
    hub: st.hub && { gateOn: st.hub.gateOn, dataThrough: st.hub.dataThrough, syms: st.hub.syms },
    tw: st.tw && { lastDay: st.tw.lastDay, open: st.tw.open },
    lf: st.lf && { asOf: st.lf.asOf, open: st.lf.open, closed: st.lf.closed },
    apex: st.apex && { lead: st.apex.lead.name, builtOn: st.apex.builtOn },
  };
}

const onOff = (v) => (v === true ? 'ON' : v === false ? 'OFF' : 'n/a');

/** Plain-language changes per site since the previous snapshot. Returns null for "no previous brief". */
export function changes(prev, st) {
  if (!prev) return null;
  const out = { Alpha: [], Tripwire: [], Rulebook: [], ApexPro: [] };
  if (prev.hub && st.hub) {
    if (prev.hub.gateOn !== st.hub.gateOn) out.Alpha.push(`Gate flipped ${onOff(prev.hub.gateOn)} → ${onOff(st.hub.gateOn)}`);
    const added = st.hub.syms.filter((x) => !prev.hub.syms.includes(x));
    const gone = prev.hub.syms.filter((x) => !st.hub.syms.includes(x));
    if (added.length) out.Alpha.push(`New signal: ${added.map(esc).join(', ')}`);
    if (gone.length) out.Alpha.push(`No longer open: ${gone.map(esc).join(', ')}`);
    if (prev.hub.dataThrough !== st.hub.dataThrough) out.Alpha.push(`New session data through ${esc(st.hub.dataThrough || 'n/a')}`);
  }
  if (prev.tw && st.tw) {
    if (prev.tw.lastDay !== st.tw.lastDay) out.Tripwire.push(`New ledger day ${esc(st.tw.lastDay || 'n/a')}: ${st.tw.picked} picked`);
    if (prev.tw.open !== st.tw.open) out.Tripwire.push(`Open paper picks ${prev.tw.open} → ${st.tw.open}`);
  }
  if (prev.lf && st.lf) {
    if (prev.lf.asOf !== st.lf.asOf) out.Rulebook.push(`Ledger updated to ${esc(st.lf.asOf || 'n/a')}`);
    if (prev.lf.open !== st.lf.open || prev.lf.closed !== st.lf.closed) out.Rulebook.push(`Open ${prev.lf.open} → ${st.lf.open}, closed ${prev.lf.closed} → ${st.lf.closed}`);
  }
  if (prev.apex && st.apex && prev.apex.lead !== st.apex.lead.name) out.ApexPro.push(`Sector heat leader: ${esc(prev.apex.lead || 'n/a')} → ${esc(st.apex.lead.name)}`);
  return out;
}

/** Stories scored by significance, with a bonus when a named company is in your Alpha signals (+0.3) or Tripwire's open paper picks (+0.1).
 *  At most 2 stories per company, so one busy stock cannot fill the whole list. */
export function pickCandidates(events, nowMs, st) {
  const sig = new Set(st.hub ? st.hub.syms : []);
  const picks = new Set(st.tw ? st.tw.openSyms : []);
  const syms = (e) => (Array.isArray(e.entities) ? e.entities.map((x) => String((x && x.sym) || '').toUpperCase()).filter(Boolean) : []);
  const scored = rank(events, nowMs).map((e, i) => {
    const ss = syms(e);
    const bonus = ss.some((x) => sig.has(x)) ? 0.3 : ss.some((x) => picks.has(x)) ? 0.1 : 0;
    return { e, mine: bonus > 0, s: (e.significance || 0) + bonus, i, key: ss[0] || null };
  }).sort((a, b) => b.s - a.s || a.i - b.i);
  const seen = {};
  const out = [];
  for (const x of scored) {
    if (x.key) { seen[x.key] = (seen[x.key] || 0) + 1; if (seen[x.key] > 2) continue; }
    out.push({ ...x.e, mine: x.mine });
  }
  return out;
}

// Some feed links are 500+ characters (Google News). Past 300 the headline is shown without a link, so a message never grows past Telegram's 4096 limit mid-tag.
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') && String(u).length <= 300 ? String(u).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') : null);
export const newsLines = (items) => items.map((e, i) => {
  const u = safeUrl(e.canonicalUrl);
  const h = esc(e.headline);
  return `${i + 1}. ${e.mine ? '★ ' : ''}${u ? `<a href="${u}">${h}</a>` : h} <i>(${esc(e.sourceTitle || 'source n/a')})</i>`;
});

function verdict(st) {
  const h = st.hub;
  const parts = [];
  parts.push(h ? `Gate ${onOff(h.gateOn)}` : 'Alpha n/a');
  if (h) parts.push(h.syms.length ? `${h.syms.length} signal${h.syms.length > 1 ? 's' : ''}` : 'no signals');
  if (st.market && st.market.nifty) parts.push(`Nifty ${sgn(st.market.nifty.pct)}`);
  if (st.market && st.market.vix && isNum(st.market.vix.px)) parts.push(`VIX ${fmt(st.market.vix.px, 1)}`);
  return parts.join(' · ');
}

/** Tripwire's price feed carries the time of its last tick. If that is not today (India), there was no trading yet, or a holiday. */
const tradedToday = (m) => !!(m && m.lastDate && m.lastDate === m.todayIst);

function marketBlock(st, slotId) {
  const m = st.market;
  if (!m || !m.nifty) return '<b>Market</b>\nn/a (Tripwire price feed unavailable)';
  const row = (label, x, d) => (x ? `${label}: ${fmt(x.px, d)} (${sgn(x.pct)})` : `${label}: n/a`);
  const body = `${row('Nifty', m.nifty, 0)}\n${row('Bank Nifty', m.bank, 0)}\n${row('VIX', m.vix, 2)}`;
  if (slotId === 'morning') return `<b>Last close</b> (${esc(m.lastDate || 'date n/a')}, Tripwire delayed feed)\n${body}`;
  if (!tradedToday(m)) return `<b>Market</b>\nNo trading data for today yet (holiday, or the delayed feed has not caught up). Last tick: ${esc(m.lastDate || 'n/a')}.\n${body}`;
  return `<b>${slotId === 'open' ? 'Market so far' : 'Market close'}</b> (Tripwire delayed feed)\n${body}`;
}

function slotBlock(slotId, st) {
  const h = st.hub;
  const lines = [];
  if (slotId === 'morning' && h) {
    lines.push(`Gate ${onOff(h.gateOn)}${h.passed !== null && h.total !== null ? ` (${h.passed} of ${h.total} rules pass)` : ''}, data through ${esc(h.dataThrough || 'n/a')}.`);
    if (!h.alertable && h.why) lines.push(`<i>Hub alerts are off. ${esc(h.why.replace(/^Alerts off:\s*/i, '').replace(/^./, (c) => c.toUpperCase()))}</i>`);
  }
  if (slotId === 'close') {
    const fl = st.flows;
    if (fl && fl.fii) lines.push(`FII net ${fmt(fl.fii.fii, 0)} · DII net ${fmt(fl.fii.dii, 0)} (NSE provisional, ${esc(fl.fii.date || 'date n/a')}; as published, unit not stated)`);
    if (fl && fl.breadth) lines.push(`Breadth (${esc(fl.breadth.asOf || 'date n/a')}): ${fmt(fl.breadth.up, 0)} up, ${fmt(fl.breadth.down, 0)} down, ${fmt(fl.breadth.mixed, 0)} mixed of ${fmt(fl.breadth.n, 0)}`);
    if (fl && fl.macro && fl.macro.length) lines.push(fl.macro.map((x) => `${x.label} ${fmt(x.px, x.d)} (${sgn(x.pct)}${x.live ? '' : ', not live'})`).join(' · '));
    if (st.tw) lines.push(`Tripwire paper picks: ${st.tw.open} open, average move since entry ${sgn(st.tw.avgPct)} (ledger day ${esc(st.tw.lastDay || 'n/a')}).`);
    if (st.lf) lines.push(`Rulebook paper book: ${st.lf.open} open, ${st.lf.closed} closed, equity ${fmt(st.lf.equity, 0)}, unrealised ${fmt(st.lf.unreal, 0)} (as of ${esc(st.lf.asOf || 'n/a')}).`);
    if (h) lines.push(`Alpha record: ${fmt(h.record.closed, 0)} closed, ${fmt(h.record.wins, 0)} wins, ${fmt(h.record.total_r)} R total.`);
  }
  if (st.apex) lines.push(`Sector heat (${esc(st.apex.builtOn || 'date n/a')}): lead ${esc(st.apex.lead.name)} ${sgn(st.apex.lead.median)}, lag ${esc(st.apex.lag.name)} ${sgn(st.apex.lag.median)}; ${fmt(st.apex.up, 0)} up, ${fmt(st.apex.down, 0)} down of ${fmt(st.apex.counted, 0)}.`);
  return lines.join('\n');
}

const SITE_KEYS = { Alpha: 'hub', Tripwire: 'tw', Rulebook: 'lf', ApexPro: 'apex' };

/** Build the message. news = already chosen stories (max 5). prev = previous snapshot or null. Returns { text, buttons }. */
export function compose(slot, st, prev, news, nowMs = Date.now()) {
  let list = news;
  let r = build(slot, st, prev, list, nowMs);
  while (r.text.length > 3800 && list.length) { list = list.slice(0, -1); r = build(slot, st, prev, list, nowMs); }
  return { ...r, shown: list };
}

function build(slot, st, prev, news, nowMs) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const when = f.format(new Date(nowMs)).replace(',', '');
  const ch = changes(prev, st);
  const down = Object.entries(SITE_KEYS).filter(([, k]) => !st[k]).map(([n]) => n);
  const anyChange = ch && Object.values(ch).some((a) => a.length);
  const marketOpen = tradedToday(st.market);
  const head = `<b>${esc(slot.title)} · ${esc(when)} MYT</b>\n${esc(verdict(st))}`;
  // Quiet day: nothing changed, no trading today and no news left to send. One line, no ping-worthy noise.
  if (ch && !anyChange && !down.length && !news.length && slot.id !== 'morning' && !marketOpen) {
    return { text: `${head}\nNo changes since the last brief. No trading data for today.`, buttons: LINKS };
  }
  const out = [head, '', marketBlock(st, slot.id)];
  const extra = slotBlock(slot.id, st);
  if (extra) out.push('', extra);
  if (ch) {
    const lines = [];
    const quiet = [];
    for (const [name, arr] of Object.entries(ch)) {
      if (down.includes(name)) continue;
      if (arr.length) lines.push(...arr.map((x) => `• <b>${name}</b>: ${x}`)); else quiet.push(name);
    }
    out.push('', '<b>Since the last brief</b>');
    if (lines.length) out.push(...lines);
    out.push(quiet.length ? `No change: ${quiet.join(', ')}` : '');
  } else {
    out.push('', '<i>First brief: nothing earlier to compare with, so this is the full state.</i>');
  }
  if (down.length) out.push(`<i>Source unavailable: ${down.join(', ')}</i>`);
  if (news.length) out.push('', `<b>News (${news.length})</b> ★ = a company in your signals or Tripwire's open picks`, ...newsLines(news));
  out.push('', '<i>Paper research, educational, not advice.</i>');
  return { text: out.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n'), buttons: LINKS };
}

/** Fetch every feed the brief needs. A failed feed is null, never a throw: one dead site must not cancel the brief. */
export async function gather(deps, slotId) {
  const get = async (u) => { try { return await deps.getJSON(u); } catch { return null; } };
  const close = slotId === 'close';
  const TW = 'https://tripwire.askakshay.com/api/';
  const [pulse, signals, ledger, rulebook, hubPulse, news, fiidii, breadth, macro] = await Promise.all([
    get(SOURCES.pulse), get(SOURCES.signals), get(SOURCES.ledger), get(SOURCES.rulebook), get(SOURCES.hubPulse), slotId === 'weekly' ? null : get(deps.newsUrl),
    close ? get(TW + 'fiidii') : null, close ? get(TW + 'breadth') : null, close ? get(TW + 'macro') : null,
  ]);
  return { feeds: { pulse, signals, ledger, rulebook, hubPulse, fiidii, breadth, macro }, events: news && Array.isArray(news.events) ? news.events : [] };
}
