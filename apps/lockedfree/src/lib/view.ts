/** Selectors over the ledger. Pages call these and format; nothing else derives a performance number (check 2). */
import type { Ledger, Aggregate, Pick, BookDay } from './ledger.ts';
import { tradeResult } from './gate.ts'; import { timeLimit, ruleText } from './exitrules.ts';
export const inr = (x: number | null | undefined, d = 0) => (x == null ? '—' : (x < 0 ? '−' : '') + '₹' + Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const signed = (x: number | null | undefined, d = 0, suffix = '') => (x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }) + suffix);
export const dmy = (iso: string | null | undefined) => { if (!iso) return 'not yet'; const [y, m, d] = iso.split('-'); return `${+d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y}`; };
export interface HeroPoint { date: string; ret: number | null; bench: number | null; dd: number }
/** Return on notional committed (%), benchmark change since the first book day (%), and drawdown in percentage points from the running peak. Gaps stay gaps. */
export function heroSeries(L: Ledger, screen = 'all'): HeroPoint[] {
  const days = L.book_days.filter((b) => b.screen_id === screen).sort((a, b) => a.date.localeCompare(b.date)); const b0 = days.find((d) => d.benchmark_close)?.benchmark_close ?? null;
  const base = (d: BookDay) => (L.config.capital && screen === 'all' ? L.config.capital : d.committed); let peak = -Infinity; return days.map((d) => { const ret = base(d) > 0 ? (d.equity / base(d)) * 100 : null; if (ret != null) peak = Math.max(peak, ret);
    return { date: d.date, ret: ret == null ? null : Math.round(ret * 100) / 100, bench: b0 && d.benchmark_close ? Math.round((d.benchmark_close / b0 - 1) * 1e4) / 100 : null, dd: ret != null && peak > -Infinity ? Math.round((ret - peak) * 100) / 100 : 0 }; });
}
export const agg = (L: Ledger, id: string): Aggregate | undefined => L.aggregates.find((a) => a.screen_id === id);
export const lastDay = (L: Ledger, id = 'all'): BookDay | undefined => L.book_days.filter((b) => b.screen_id === id).sort((a, b) => a.date.localeCompare(b.date)).pop();
export const recordStarted = (L: Ledger) => L.book_days.length > 0;
export interface TradeRow { id: string; symbol: string; screen_id: string; status: Pick['status']; entry: string | null; entry_px: number | null; exit: string | null; exit_px: number | null; reason: string; pnl: number | null; r: number | null;
  /** `pnl` and `pct` are AFTER charges (the ledger's own figure); `gross` and `gross_pct` are the price change alone. Shares, rupees put in, the price it is marked on (latest close, or the exit), result as % of the rupees put in, the stop and target prices, and the last day it may be held */
  qty: number | null; invested: number | null; last: number | null; pct: number | null; /** price change only, before any charges: 0 when entry and last price are equal */ gross: number | null; gross_pct: number | null; stop: number | null; target: number | null; exit_by: string | null; rule: string }
export const REASON: Record<string, string> = { dropped: 'Left the list', stop: 'Stop hit', 'gap-stop': 'Gapped through the stop', target: 'Target reached', 'gap-target': 'Gapped above the target', time: 'One month is up' };
export function tradeRows(L: Ledger, mark: (s: string) => number | null): TradeRow[] {
  return L.picks.map((p) => { const f0 = p.fills[0], inv = f0 ? Math.round(f0.qty * f0.price * 100) / 100 : null, tgt = f0 && p.rule ? Math.round(f0.price * (1 + p.rule.target_pct / 100) * 100) / 100 : null;
    const ext = { qty: f0?.qty ?? null, invested: inv, stop: p.stop, target: tgt, exit_by: f0 ? timeLimit(f0.date) : null, rule: ruleText(p.screen_id) };
    const base = { ...ext, last: null as number | null, pct: null as number | null, gross: null as number | null, gross_pct: null as number | null, id: p.id, symbol: p.symbol, screen_id: p.screen_id, status: p.status, entry: p.fills[0]?.date ?? null, entry_px: p.fills[0]?.price ?? null, exit: p.fills.find((f) => f.side === 'sell')?.date ?? null, exit_px: p.fills.find((f) => f.side === 'sell')?.price ?? null };
    if (p.status === 'pending') return { ...base, reason: 'Waiting for the next session open', pnl: null, r: null };
    if (p.status === 'voided') return { ...base, reason: p.voided?.reason ?? 'voided', pnl: null, r: null };
    const open = p.status === 'open', m = open ? mark(p.symbol) : null; if (open && m == null) return { ...base, reason: 'No price for this name — shown as missing', pnl: null, r: null };
    const res = tradeResult({ id: p.id, symbol: p.symbol, setup: '', trigger: '', stop: p.stop!, target: 0, riskPct: 0, qty: p.fills[0].qty, qtyOverrideReason: null, entry: { date: p.fills[0].date, price: p.fills[0].price }, exit: p.fills[1] ? { date: p.fills[1].date, price: p.fills[1].price } : null, ruleBreak: false, review: null, reviewSkipped: false }, m);
    const lastPx = open ? m : base.exit_px; const gross = f0 && lastPx != null ? Math.round(f0.qty * (lastPx - f0.price) * 100) / 100 : null; return { ...base, last: lastPx, gross, gross_pct: f0 && lastPx != null ? Math.round((lastPx / f0.price - 1) * 1e4) / 100 : null, pct: inv ? Math.round((res.total / inv) * 1e4) / 100 : null, reason: open ? 'Open' : REASON[p.exit_reason ?? ''] ?? 'Closed', pnl: res.total, r: res.r }; });
}

export const holdDays = (a: string | null, b: string | null) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 864e5) : null);
export interface ClosedStats { n: number; wins: number; losses: number; profitFactor: number | null; avgWin: number | null; avgLoss: number | null; avgHold: number | null; best: number | null; worst: number | null }
/** Closed-call statistics after charges (the ledger's own net figure). Null where there is nothing to divide by; the caller prints n beside them and the small-sample label. */
export function closedStats(rows: TradeRow[]): ClosedStats {
  const c = rows.filter((t) => t.status === 'closed' && t.pnl != null); const w = c.filter((t) => (t.pnl as number) > 0), l = c.filter((t) => (t.pnl as number) <= 0); const sum = (a: TradeRow[]) => a.reduce((x, t) => x + (t.pnl as number), 0); const holds = c.map((t) => holdDays(t.entry, t.exit)).filter((x): x is number => x != null);
  return { n: c.length, wins: w.length, losses: l.length, profitFactor: l.length && sum(l) !== 0 ? Math.round((sum(w) / Math.abs(sum(l))) * 100) / 100 : null, avgWin: w.length ? Math.round(sum(w) / w.length) : null, avgLoss: l.length ? Math.round(sum(l) / l.length) : null, avgHold: holds.length ? Math.round((holds.reduce((a, b) => a + b, 0) / holds.length) * 10) / 10 : null, best: c.length ? Math.max(...c.map((t) => t.pnl as number)) : null, worst: c.length ? Math.min(...c.map((t) => t.pnl as number)) : null };
}
export interface BookState { capital: number; ticket: number; maxOpen: number; sectorCap: number; open: number; deployed: number; cash: number; equity: number; charges: number }
/** The account in rupees from the ledger's own fills: cost of open positions, cash left after costs and booked results, and equity. Uses the shared accounting, nothing else. */
export function bookState(L: Ledger, mark: (s: string) => number | null): BookState | null {
  const capital = L.config.capital; if (!capital) return null; let deployed = 0, openN = 0, realised = 0, charges = 0, unreal = 0;
  for (const p of L.picks) { if (p.status === 'voided' || p.status === 'pending' || !p.fills.length) continue; const r = tradeResult({ id: p.id, symbol: p.symbol, setup: '', trigger: '', stop: p.stop!, target: 0, riskPct: 0, qty: p.fills[0].qty, qtyOverrideReason: null, entry: { date: p.fills[0].date, price: p.fills[0].price }, exit: p.fills[1] ? { date: p.fills[1].date, price: p.fills[1].price } : null, ruleBreak: false, review: null, reviewSkipped: false }, mark(p.symbol) ?? p.fills[0].price);
    charges += r.chargesTotal; realised += r.realised; unreal += r.unrealised; if (p.status === 'open') { deployed += r.qtyOpen * r.avgCost; openN++; } }
  return { capital, ticket: L.config.ticket ?? 0, maxOpen: L.config.max_open ?? 0, sectorCap: L.config.sector_cap ?? 0, open: openN, deployed: Math.round(deployed), cash: Math.round(capital + realised - deployed - (charges - (realised ? 0 : 0))), equity: Math.round(capital + realised + unreal), charges: Math.round(charges) };
}
