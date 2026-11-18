/** Selectors over the ledger. Pages call these and format; nothing else derives a performance number (check 2). */
import type { Ledger, Aggregate, Pick, BookDay } from './ledger.ts';
import { tradeResult } from './gate.ts';
export const inr = (x: number | null | undefined, d = 0) => (x == null ? '—' : (x < 0 ? '−' : '') + '₹' + Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const signed = (x: number | null | undefined, d = 0, suffix = '') => (x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }) + suffix);
export const dmy = (iso: string | null | undefined) => { if (!iso) return 'not yet'; const [y, m, d] = iso.split('-'); return `${+d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y}`; };
export interface HeroPoint { date: string; ret: number | null; bench: number | null; dd: number }
/** Return on notional committed (%), benchmark change since the first book day (%), and drawdown in percentage points from the running peak. Gaps stay gaps. */
export function heroSeries(L: Ledger, screen = 'all'): HeroPoint[] {
  const days = L.book_days.filter((b) => b.screen_id === screen).sort((a, b) => a.date.localeCompare(b.date)); const b0 = days.find((d) => d.benchmark_close)?.benchmark_close ?? null;
  let peak = -Infinity; return days.map((d) => { const ret = d.committed > 0 ? (d.equity / d.committed) * 100 : null; if (ret != null) peak = Math.max(peak, ret);
    return { date: d.date, ret: ret == null ? null : Math.round(ret * 100) / 100, bench: b0 && d.benchmark_close ? Math.round((d.benchmark_close / b0 - 1) * 1e4) / 100 : null, dd: ret != null && peak > -Infinity ? Math.round((ret - peak) * 100) / 100 : 0 }; });
}
export const agg = (L: Ledger, id: string): Aggregate | undefined => L.aggregates.find((a) => a.screen_id === id);
export const lastDay = (L: Ledger, id = 'all'): BookDay | undefined => L.book_days.filter((b) => b.screen_id === id).sort((a, b) => a.date.localeCompare(b.date)).pop();
export const recordStarted = (L: Ledger) => L.book_days.length > 0;
export interface TradeRow { id: string; symbol: string; screen_id: string; status: Pick['status']; entry: string | null; entry_px: number | null; exit: string | null; exit_px: number | null; reason: string; pnl: number | null; r: number | null }
export function tradeRows(L: Ledger, mark: (s: string) => number | null): TradeRow[] {
  return L.picks.map((p) => { const base = { id: p.id, symbol: p.symbol, screen_id: p.screen_id, status: p.status, entry: p.fills[0]?.date ?? null, entry_px: p.fills[0]?.price ?? null, exit: p.fills.find((f) => f.side === 'sell')?.date ?? null, exit_px: p.fills.find((f) => f.side === 'sell')?.price ?? null };
    if (p.status === 'pending') return { ...base, reason: 'Waiting for the next session open', pnl: null, r: null };
    if (p.status === 'voided') return { ...base, reason: p.voided?.reason ?? 'voided', pnl: null, r: null };
    const open = p.status === 'open', m = open ? mark(p.symbol) : null; if (open && m == null) return { ...base, reason: 'No price for this name — shown as missing', pnl: null, r: null };
    const res = tradeResult({ id: p.id, symbol: p.symbol, setup: '', trigger: '', stop: p.stop!, target: 0, riskPct: 0, qty: p.fills[0].qty, qtyOverrideReason: null, entry: { date: p.fills[0].date, price: p.fills[0].price }, exit: p.fills[1] ? { date: p.fills[1].date, price: p.fills[1].price } : null, ruleBreak: false, review: null, reviewSkipped: false }, m);
    return { ...base, reason: open ? 'Open' : p.exit_reason === 'dropped' ? 'Left the list' : p.exit_reason === 'stop' ? 'Stop hit' : 'Gapped through the stop', pnl: res.total, r: res.r }; });
}
