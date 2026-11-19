// Saturday weekly review: last 7 days of Tripwire's paper ledger, Rulebook's paper book and Alpha's gate and record.
import { esc } from './commands.js';
import { localParts } from './news.js';
import { TZ, LINKS } from './briefs.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const n = (v, d = 2) => (isNum(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: d }) : 'n/a');
const sgn = (p) => (isNum(p) ? `${p >= 0 ? '+' : ''}${p.toFixed(2)}%` : 'n/a');
const dayMinus = (date, k) => new Date(Date.parse(date + 'T00:00:00Z') - k * 864e5).toISOString().slice(0, 10);

export function composeWeekly(f, nowMs) {
  const today = localParts(nowMs, TZ).date;
  const from = dayMinus(today, 7);
  const out = [`<b>Weekly review · ${esc(today)} MYT</b>`, `<i>Window: ${esc(from)} to ${esc(today)}. Paper books only.</i>`, ''];
  const l = f.ledger && f.ledger.ledger;
  out.push('<b>Tripwire (paper ledger)</b>');
  if (l && Array.isArray(l.picks)) {
    const oc = Object.entries(l.outcomes || {}).filter(([, o]) => o);
    const open = oc.filter(([, o]) => o.status === 'open');
    const moves = open.map(([, o]) => o.pct).filter(isNum);
    const closedWk = oc.filter(([, o]) => o.status === 'closed' && o.exitDay >= from);
    const wins = closedWk.filter(([, o]) => isNum(o.r) && o.r > 0).length;
    const rSum = closedWk.map(([, o]) => o.r).filter(isNum).reduce((a, b) => a + b, 0);
    const picksWk = l.picks.filter((p) => p.asOf >= from).length;
    out.push(`${picksWk} new picks this week · ${open.length} open (average move since entry ${sgn(moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : null)}, target 1 hit on ${open.filter(([, o]) => o.t1Hit).length})`);
    out.push(`${closedWk.length} closed this week: ${wins} winners · ${n(rSum, 1)} R in total${closedWk.length ? ` (${[...new Set(closedWk.map(([, o]) => esc(o.reason || 'n/a')))].join(', ')})` : ''}`);
  } else out.push('n/a (ledger unavailable)');
  out.push('', '<b>Rulebook (paper book)</b>');
  const r = f.rulebook;
  if (r && Array.isArray(r.aggregates)) {
    const days = (r.book_days || []).filter((b) => b.screen_id === 'all').sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const now = days[days.length - 1];
    const then = [...days].reverse().find((b) => b.date <= from) || days[0];
    const d = now && then && isNum(now.equity) && isNum(then.equity) && now.date !== then.date ? now.equity - then.equity : null;
    out.push(`${r.aggregates.reduce((a, x) => a + (isNum(x.n_open) ? x.n_open : 0), 0)} open · ${r.aggregates.reduce((a, x) => a + (isNum(x.n_closed) ? x.n_closed : 0), 0)} closed · equity ${n(now && now.equity, 0)} (${isNum(d) ? `${d >= 0 ? '+' : ''}${n(d, 0)} since ${esc(then.date)}` : 'no earlier day to compare'}) · as of ${esc(r.as_of || 'n/a')}`);
  } else out.push('n/a (ledger unavailable)');
  out.push('', '<b>Alpha (hub)</b>');
  const s = f.signals;
  if (s && s.gate) {
    const hist = (Array.isArray(s.gate_history) ? s.gate_history : []).slice(-5);
    out.push(`Gate ${s.gate.on === true ? 'ON' : s.gate.on === false ? 'OFF' : 'n/a'} now · ON on ${hist.filter((x) => x.on === true).length} of the last ${hist.length} sessions · record ${n(s.record && s.record.closed, 0)} closed, ${n(s.record && s.record.wins, 0)} wins, ${n(s.record && s.record.total_r)} R`);
  } else out.push('n/a (hub unavailable)');
  out.push('', '<i>Educational, not advice.</i>');
  return { text: out.join('\n'), buttons: LINKS };
}
