/** The paper tracker: replays real daily bars against a paper position, with fixed rules and no hindsight.
 *
 *  Entry   the open of the first session that begins AFTER the paper trade was taken (a pick published after the close cannot
 *          be bought at that close). Skipped if that open is more than 2% above the signal close, or at or below the stop.
 *  Stop    fixed at the signal. A bar that opens at or below it exits at the open (a gap); a bar that trades through it exits at
 *          the stop. If one bar spans the stop it is the stop that counts. Targets are not used: these are ranking engines.
 *  Time    exit at the close of the Nth session, the entry session being the first.
 *  Costs   a round-trip cost on the traded value plus a fixed slippage on each side, both stated on screen; real fills differ.
 *  Live    a forming bar can trigger the stop through its low, but never a time exit. Its last price is a mark, not a close.
 *  P&L is only ever computed from bars the Worker returned; a position with no bars is "waiting for data", never flat. */
export interface Bar { t: number; o: number; h: number; l: number; c: number; forming?: boolean }
export interface Paper { id: string; sym: string; engine: string; asOf: string; ref: number; stop: number; horizon: number; qty: number; takenAt: number; note?: string; closedByUser?: boolean }
export type Status = 'waiting' | 'pending' | 'open' | 'closed' | 'skipped';
export interface View {
  id: string; status: Status; entry?: number; entryT?: number; exit?: number; exitT?: number; reason?: string; sessions: number; left: number | null;
  mark: number | null; markKind: 'live' | 'close' | null; pnl: number | null; r: number | null; pct: number | null; stopGap?: boolean; skipReason?: string;
}
export const SLIPPAGE_PCT = 0.1;          // each side
export const GAP_SKIP_PCT = 2;
const r2 = (x: number) => Math.round(x * 100) / 100;

export function evaluatePaper(p: Paper, bars: readonly Bar[] | null, live: { px: number; t: number } | null, costRoundTripPct: number): View {
  const base: View = { id: p.id, status: 'waiting', sessions: 0, left: p.horizon, mark: null, markKind: null, pnl: null, r: null, pct: null };
  if (!bars || !bars.length) return base;
  const i0 = bars.findIndex((b) => b.t > p.takenAt);
  if (i0 < 0) return { ...base, status: 'pending' };
  const first = bars[i0];
  const fill = first.o * (1 + SLIPPAGE_PCT / 100);
  if (first.o > p.ref * (1 + GAP_SKIP_PCT / 100)) return { ...base, status: 'skipped', skipReason: `Opened ${(((first.o / p.ref) - 1) * 100).toFixed(1)}% above the signal close (limit ${GAP_SKIP_PCT}%)` };
  if (first.o <= p.stop) return { ...base, status: 'skipped', skipReason: 'Opened at or below the stop' };
  const risk = fill - p.stop;
  const costOf = (exit: number) => (costRoundTripPct / 100) * fill * p.qty + (SLIPPAGE_PCT / 100) * exit * p.qty;
  const done = (exit: number, t: number, reason: string, sessions: number, gap = false): View => {
    const pnl = (exit - fill) * p.qty - costOf(exit);
    return { ...base, status: 'closed', entry: r2(fill), entryT: first.t, exit: r2(exit), exitT: t, reason, sessions, left: 0, mark: r2(exit), markKind: 'close', pnl: r2(pnl), r: risk > 0 ? r2(pnl / (risk * p.qty)) : null, pct: r2((pnl / (fill * p.qty)) * 100), stopGap: gap };
  };
  let sessions = 0;
  for (let i = i0; i < bars.length; i++) {
    const b = bars[i]; sessions++;
    if (i !== i0 && b.o <= p.stop) return done(b.o, b.t, 'Stop (gapped through)', sessions, true);
    if (b.l <= p.stop) return done(p.stop, b.t, 'Stop', sessions);
    if (!b.forming && sessions >= p.horizon) return done(b.c, b.t, `Time exit after ${p.horizon} sessions`, sessions);
  }
  const last = bars[bars.length - 1];
  const useLive = live && live.t >= last.t && (last.forming || live.t > last.t);
  const mark = useLive ? live!.px : last.c;
  const pnl = (mark - fill) * p.qty - costOf(mark);
  return { ...base, status: 'open', entry: r2(fill), entryT: first.t, sessions, left: Math.max(0, p.horizon - sessions), mark: r2(mark), markKind: useLive ? 'live' : 'close', pnl: r2(pnl), r: risk > 0 ? r2(pnl / (risk * p.qty)) : null, pct: r2((pnl / (fill * p.qty)) * 100) };
}

/** Totals over the closed paper trades. Expectancy is withheld below 30: a handful of trades says nothing. */
export function summarize(views: readonly View[]) {
  const closed = views.filter((v) => v.status === 'closed' && v.r != null);
  const open = views.filter((v) => v.status === 'open');
  const wins = closed.filter((v) => v.r! > 0).length;
  const totalR = closed.reduce((s, v) => s + v.r!, 0);
  return { open: open.length, closed: closed.length, waiting: views.filter((v) => v.status === 'waiting' || v.status === 'pending').length, skipped: views.filter((v) => v.status === 'skipped').length,
    openPnl: open.reduce((s, v) => s + (v.pnl ?? 0), 0), closedPnl: closed.reduce((s, v) => s + (v.pnl ?? 0), 0), totalR: r2(totalR), wins,
    avgR: closed.length >= 30 ? r2(totalR / closed.length) : null, enough: closed.length >= 30 };
}

/** What a position would be worth at any price, by exactly the arithmetic evaluatePaper uses (so the slider and the headline never disagree). */
export function pnlAt(p: Pick<Paper, 'qty' | 'stop'>, entry: number, price: number, costRoundTripPct: number): { pnl: number; r: number | null; pct: number } {
  const pnl = (price - entry) * p.qty - (costRoundTripPct / 100) * entry * p.qty - (SLIPPAGE_PCT / 100) * price * p.qty;
  const risk = entry - p.stop;
  return { pnl: r2(pnl), r: risk > 0 ? r2(pnl / (risk * p.qty)) : null, pct: r2((pnl / (entry * p.qty)) * 100) };
}
/** Where a price sits on the risk ladder: -1 at the stop, 0 at the entry, +1 at one risk unit up. */
export const rLevel = (price: number, entry: number, stop: number): number | null => (entry - stop > 0 ? (price - entry) / (entry - stop) : null);
