/** The live blotter: every open position as one line with its own live P&L, the day's total as a curve, and a risk lens on the book.
 *  Pure, so each figure can be checked by hand. Nothing here predicts: the risk lens says what the last 60 sessions did to THIS book, not what will happen. */
import type { BookRow } from './book.ts';
import { styleOf } from './exits.ts';

export interface Line { id: string; sym: string; engine: string; style: 'short' | 'swing' | 'long'; qty: number; entry: number; last: number; live: boolean; value: number; pnl: number; pct: number | null; r: number | null; dayPnl: number | null;
  /** distance from the last price to the stop and to the open targets, in percent of the last price (stop is negative) */
  toStop: number | null; toT1: number | null; toT2: number | null; t1Hit: boolean; stop: number; t1: number | null; t2: number | null }
const r2 = (x: number) => Math.round(x * 100) / 100;
const pc = (to: number, from: number) => (from > 0 ? r2(((to - from) / from) * 100) : null);

export function lines(rows: readonly BookRow[]): Line[] {
  const out: Line[] = [];
  for (const { p, v, dayPnl } of rows) {
    if (v.status !== 'open' || v.entry == null || v.mark == null || v.pnl == null) continue;
    const qty = v.ladder ? v.ladder.qtyLeft : p.qty; const stop = v.ladder?.stop ?? p.stop;
    out.push({ id: p.id, sym: p.sym, engine: p.engine, style: styleOf(p.horizon), qty, entry: v.entry, last: v.mark, live: v.markKind === 'live', value: r2(v.mark * qty), pnl: v.pnl, pct: v.pct, r: v.r, dayPnl,
      toStop: pc(stop, v.mark), toT1: v.ladder && !v.ladder.t1Hit ? pc(v.ladder.t1, v.mark) : null, toT2: v.ladder && !v.ladder.t2Hit ? pc(v.ladder.t2, v.mark) : null, t1Hit: !!v.ladder?.t1Hit, stop, t1: v.ladder?.t1 ?? null, t2: v.ladder?.t2 ?? null });
  }
  return out;
}
export interface Totals { open: number; value: number; cost: number; pnl: number; pct: number | null; dayPnl: number | null; best: Line | null; worst: Line | null }
export function totals(ls: readonly Line[]): Totals {
  const value = ls.reduce((a, l) => a + l.value, 0), pnl = ls.reduce((a, l) => a + l.pnl, 0); const cost = ls.reduce((a, l) => a + l.entry * l.qty, 0);
  const day = ls.filter((l) => l.dayPnl != null);
  const sorted = [...ls].sort((a, b) => b.pnl - a.pnl);
  return { open: ls.length, value: r2(value), cost: r2(cost), pnl: r2(pnl), pct: cost > 0 ? r2((pnl / cost) * 100) : null, dayPnl: day.length ? r2(day.reduce((a, l) => a + (l.dayPnl ?? 0), 0)) : null, best: sorted[0] ?? null, worst: sorted.length ? sorted[sorted.length - 1] : null };
}
const dayKey = (t: number) => Math.floor((t + 19800) / 86400);
/** The day's P&L over time: for each five-minute stamp, the sum over open positions of quantity times (close at that stamp minus the base). The base is the entry price for a
 *  position entered today and the previous close otherwise, so the last point equals the day total. A position with no print yet at a stamp contributes zero (it sits at its base). */
export function dayCurve(rows: readonly BookRow[]): { t: number; v: number }[] {
  const live = rows.filter((r) => r.v.status === 'open' && r.q && r.q.t.length > 1 && r.v.entry != null);
  if (!live.length) return [];
  const ts = [...new Set(live.flatMap((r) => r.q!.t))].sort((a, b) => a - b);
  const prep = live.map((r) => { const q = r.q!; const today = r.v.entryT != null && dayKey(r.v.entryT) === dayKey(q.pt); const base = today ? r.v.entry! : q.prev; const qty = r.v.ladder ? r.v.ladder.qtyLeft : r.p.qty; return { q, base, qty }; });
  const idx = prep.map(() => -1);
  return ts.map((t) => { let v = 0; prep.forEach((x, k) => { while (idx[k] + 1 < x.q.t.length && x.q.t[idx[k] + 1] <= t) idx[k]++; if (idx[k] >= 0) v += x.qty * (x.q.c[idx[k]] - x.base); }); return { t, v: r2(v) }; });
}
export interface Risk { topPosition: { sym: string; pct: number } | null; topSector: { name: string; pct: number } | null; effectiveBets: number | null; avgCorrelation: number | null; sessions: number; worstDay: number | null; badDay: number | null; vol: number | null }
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
function corr(a: number[], b: number[]): number | null { const n = Math.min(a.length, b.length); if (n < 20) return null; const x = a.slice(-n), y = b.slice(-n); const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null; }
/** How concentrated the book is and how it moved together over the last `N` sessions. `closes` is each symbol's daily closes in time order. The portfolio's historical day is the value-weighted
 *  sum of the names' own daily returns on the days ALL of them traded; "bad day" is the 5th percentile of those days (one session in twenty was worse), "worst day" the minimum. A description of the past of
 *  this book, not a forecast, and it needs 40 shared sessions or it says nothing. */
export function riskLens(ls: readonly Line[], sectorOf: (sym: string) => string | null, closes: Record<string, { t: number[]; c: number[] } | undefined>, N = 60): Risk {
  const tot = ls.reduce((a, l) => a + l.value, 0); const none: Risk = { topPosition: null, topSector: null, effectiveBets: null, avgCorrelation: null, sessions: 0, worstDay: null, badDay: null, vol: null };
  if (!ls.length || !(tot > 0)) return none;
  const w = ls.map((l) => l.value / tot); const top = ls.reduce((a, l) => (l.value > a.value ? l : a), ls[0]);
  const sec = new Map<string, number>(); ls.forEach((l, i) => { const s = sectorOf(l.sym) ?? 'Sector not stated'; sec.set(s, (sec.get(s) ?? 0) + w[i]); });
  const ts = [...sec.entries()].sort((a, b) => b[1] - a[1])[0];
  const base: Risk = { ...none, topPosition: { sym: top.sym, pct: r2((top.value / tot) * 100) }, topSector: { name: ts[0], pct: r2(ts[1] * 100) }, effectiveBets: r2(1 / w.reduce((a, x) => a + x * x, 0)) };
  // aligned daily returns on the days every name traded
  const series = ls.map((l) => closes[l.sym]); if (series.some((s) => !s || s.c.length < 41)) return base;
  const maps = series.map((s) => new Map(s!.t.map((t, i) => [dayKey(t), s!.c[i]] as const)));
  const days = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort((a, b) => a - b).slice(-(N + 1));
  if (days.length < 41) return base;
  const rets = maps.map((m) => days.slice(1).map((d, i) => m.get(d)! / m.get(days[i])! - 1));
  const pr = days.slice(1).map((_, i) => rets.reduce((a, r, k) => a + w[k] * r[i], 0)).sort((a, b) => a - b);
  let cs: number[] = []; for (let i = 0; i < rets.length; i++) for (let j = i + 1; j < rets.length; j++) { const c = corr(rets[i], rets[j]); if (c !== null) cs.push(c); }
  const m = mean(pr); const sd = Math.sqrt(mean(pr.map((x) => (x - m) ** 2)));
  return { ...base, avgCorrelation: cs.length ? r2(mean(cs)) : null, sessions: pr.length, worstDay: r2(pr[0] * 100), badDay: r2(pr[Math.max(0, Math.floor(pr.length * 0.05))] * 100), vol: r2(sd * 100) };
}
