// Pure command logic for the Telegram bot. No Cloudflare imports, so node --test can run it.
// deps = { getJSON(url) -> parsed JSON or throws, notes: { add(text), list(), del(n) } }
// Rule: a missing value is shown as "n/a", never as zero and never guessed.

export const SOURCES = {
  pulse: 'https://tripwire.askakshay.com/api/pulse',
  ledger: 'https://tripwire.askakshay.com/api/ledger',
  // The hub host is alpha.askakshay.com. alphavision.askakshay.com does not resolve (docs/PLATFORM.md, 19 Nov 2026).
  signals: 'https://alpha.askakshay.com/signals.json',
  hubPulse: 'https://alpha.askakshay.com/data/pulse.json',
  company: (sym) => `https://alpha.askakshay.com/c/${encodeURIComponent(sym)}.json`,
  rulebook: 'https://raw.githubusercontent.com/caakshayk1-boop/alpha/main/apps/lockedfree/ledger/ledger.json',
};

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (v, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: d }) : 'n/a');
const pct = (px, prev) => (typeof px === 'number' && typeof prev === 'number' && prev !== 0 ? `${px >= prev ? '+' : ''}${(((px - prev) / prev) * 100).toFixed(2)}%` : 'n/a');
export const SYMBOL = /^[A-Z0-9][A-Z0-9&.\-]{0,24}$/;

export const HELP = [
  '<b>Commands</b>',
  '/pulse  Nifty, Bank Nifty, VIX (Tripwire)',
  '/signals  Alphavision gate and open signals',
  '/tripwire  Tripwire paper ledger, last day',
  '/rulebook  lockedfree screens and book',
  '/stock SYMBOL  full brief: price, trend, RSI, Tripwire picks, news, e.g. /stock INFY',
  '/news  top 10 new stories now (no repeats)',
  '/morning  /open  /close  /weekly  the briefs, on demand',
  '/watch SYMBOL ...  alert me on big moves, RSI 70/30 and news (also /unwatch, /watchlist)',
  '/remind 18:00 text  one-time reminder, Malaysia time (also /reminders, /unremind N)',
  '/digest  pulse + signals + tripwire + rulebook',
  '/note TEXT  save a note',
  '/notes  list notes',
  '/del N  delete note N',
].join('\n');

export async function pulse(deps) {
  const d = await deps.getJSON(SOURCES.pulse);
  const q = d.quotes || {};
  const line = (k, label) => (q[k] ? `${label}: ${num(q[k].px)} (${pct(q[k].px, q[k].prev)})${q[k].live ? '' : ' · not live'}` : `${label}: n/a`);
  return `<b>Market pulse</b>\n${line('NIFTY', 'Nifty')}\n${line('BANKNIFTY', 'Bank Nifty')}\n${line('VIX', 'VIX')}\n<i>Source: Tripwire, delayed. ${esc(d.fetched_at || '')}</i>`;
}

export async function signals(deps) {
  const d = await deps.getJSON(SOURCES.signals);
  const g = d.gate || {};
  const list = Array.isArray(d.signals) ? d.signals : [];
  const names = list.slice(0, 5).map((s) => esc(s.sym || s.symbol || s.s || '?'));
  const rec = d.record || {};
  return [
    '<b>Alphavision signals</b>',
    `Gate: ${g.on === true ? 'ON' : g.on === false ? 'OFF' : 'n/a'} (${esc(g.date || 'n/a')}, data through ${esc(d.data_through || 'n/a')})`,
    list.length ? `Open signals (${list.length}): ${names.join(', ')}${list.length > 5 ? ', …' : ''}` : 'Open signals: none',
    `Record: ${num(rec.closed, 0)} closed, ${num(rec.wins, 0)} wins, ${num(rec.total_r)} R total`,
    '<i>Educational research, not advice.</i>',
  ].join('\n');
}

export async function tripwire(deps) {
  const d = await deps.getJSON(SOURCES.ledger);
  const days = d && d.ledger && Array.isArray(d.ledger.days) ? d.ledger.days : [];
  if (!days.length) return '<b>Tripwire ledger</b>\nNo days recorded.';
  const last = days[days.length - 1];
  const eng = Object.entries(last.engines || {}).map(([k, v]) => `${esc(k)}: picked ${num(v.picked, 0)} of ${num(v.passed, 0)} passed`);
  return `<b>Tripwire ledger</b>\nSince ${esc(d.ledger.started || 'n/a')} · ${days.length} days · last day ${esc(last.asOf)}\n${eng.join('\n')}\n<i>Updated ${esc(d.ledger.updated || 'n/a')}</i>`;
}

export async function rulebook(deps) {
  let d;
  try { d = await deps.getJSON(SOURCES.rulebook); } catch { return '<b>Rulebook (lockedfree)</b>\nLedger not published yet.'; }
  const names = Object.fromEntries((d.screens || []).map((s) => [s.id, s.name]));
  const book = {};
  for (const b of d.book_days || []) if (!book[b.screen_id] || b.date >= book[b.screen_id].date) book[b.screen_id] = b;
  const rows = (d.aggregates || []).map((a) => {
    const b = book[a.screen_id];
    return `${esc(names[a.screen_id] || a.screen_id)}: ${num(a.n_open, 0)} open, ${num(a.n_closed, 0)} closed, win rate ${a.win_rate == null ? 'n/a' : num(a.win_rate * 100, 0) + '%'}, equity ${b ? num(b.equity, 0) : 'n/a'}`;
  });
  return `<b>Rulebook (lockedfree)</b>\nAs of ${esc(d.as_of || 'n/a')}\n${rows.join('\n') || 'No screens yet.'}\n<i>Paper book, educational.</i>`;
}

export async function stock(deps, arg) {
  const sym = String(arg || '').trim().toUpperCase();
  if (!SYMBOL.test(sym)) return 'Usage: /stock SYMBOL (letters and digits, e.g. /stock TCS)';
  let d;
  try { d = await deps.getJSON(SOURCES.company(sym)); } catch { return `No data for ${esc(sym)}.`; }
  const r = d.row || {};
  return `<b>${esc(r.name || sym)}</b> (${esc(sym)})\n${esc(r.sector || 'n/a')} · ${esc(r.tier || 'n/a')}\nPrice ${num(r.price)} (${esc(r.fy || 'n/a')} fundamentals)\nROCE ${num(r.roce, 1)}% · ROE ${num(r.roe, 1)}% · D/E ${num(r.de)} · Rev CAGR ${num(r.rev_cagr, 1)}%\n<i>Source: Alphavision. Not advice.</i>`;
}

export async function digest(deps) {
  const parts = [];
  for (const f of [pulse, signals, tripwire, rulebook]) {
    try { parts.push(await f(deps)); } catch { parts.push(`<i>${f.name}: source unavailable</i>`); }
  }
  return parts.join('\n\n');
}

export async function notes(deps, cmd, arg) {
  if (cmd === 'note') {
    const t = String(arg || '').trim();
    if (!t) return 'Usage: /note TEXT';
    if (t.length > 500) return 'Note too long (500 characters max).';
    const n = await deps.notes.add(t);
    return `Saved as note ${n}.`;
  }
  if (cmd === 'del') {
    const n = Number(String(arg || '').trim());
    if (!Number.isInteger(n) || n < 1) return 'Usage: /del N';
    return (await deps.notes.del(n)) ? `Deleted note ${n}.` : `No note ${n}.`;
  }
  const list = await deps.notes.list();
  return list.length ? '<b>Notes</b>\n' + list.map((x, i) => `${i + 1}. ${esc(x.text)} <i>(${esc(x.at.slice(0, 10))})</i>`).join('\n') : 'No notes yet.';
}

/** Parse "/cmd@bot arg" and run it. Returns the HTML reply, or null for non-commands. */
export async function handle(text, deps) {
  const m = /^\/([a-z]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(String(text || '').trim());
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const arg = m[2] || '';
  try {
    switch (cmd) {
      case 'start': case 'help': return HELP;
      case 'pulse': return await pulse(deps);
      case 'signals': return await signals(deps);
      case 'tripwire': return await tripwire(deps);
      case 'rulebook': case 'lockedfree': return await rulebook(deps);
      case 'stock': return deps.stockBrief ? await deps.stockBrief(deps, arg) : await stock(deps, arg);
      case 'digest': return await digest(deps);
      case 'note': case 'notes': case 'del': return await notes(deps, cmd, arg);
      default: return 'Unknown command. Send /help.';
    }
  } catch {
    return 'That source is unavailable right now. Try again shortly.';
  }
}
