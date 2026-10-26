/** The paper tracker: replays real daily bars against a paper position, with fixed rules and no hindsight.
 *
 *  Entry   the open of the first session that begins AFTER the paper trade was taken (a pick published after the close cannot
 *          be bought at that close). Skipped if that open is more than 2% above the signal close, or at or below the stop.
 *  Stop    fixed at the signal. A bar that opens at or below it exits at the open (a gap); a bar that trades through it exits at
 *          the stop. If one bar spans the stop it is the stop that counts. Targets are not used: these are ranking engines.
 *  Time    exit at the close of the Nth session, the entry session being the first.
 *  Costs   a round-trip cost on the traded value plus a fixed slippage on each side, both stated on screen; real fills differ.
 *  Live    a forming bar can trigger the stop through its low, but never a time exit. Its last price is a mark, not a close.
 *  P&L is only ever computed from bars the Worker returned; a position with no bars is "waiting for data", never flat.
 *
 *  Four different prices, never blurred: SIGNAL (the engine's close on the data day, where the stop is measured from), FILL (the next open plus slippage),
 *  LATEST (the last close, or a live print while the session is on) and the P&L BASIS (fill to latest or exit, minus costs and exit slippage).
 *  Sessions are the bars that exist: an exchange holiday has no bar, so it is never counted. Dividends are not received (bars are not dividend-adjusted, so
 *  an ex-dividend drop is a real price move here and the payout is ignored: conservative). Splits and bonuses are handled by `rebase`. */
export interface Bar { t: number; o: number; h: number; l: number; c: number; forming?: boolean }
export interface Paper { id: string; sym: string; engine: string; asOf: string; ref: number; stop: number; horizon: number; qty: number; takenAt: number; note?: string; closedByUser?: boolean }
export type Status = 'waiting' | 'pending' | 'open' | 'closed' | 'skipped';
export interface View {
  id: string; status: Status; entry?: number; entryT?: number; exit?: number; exitT?: number; reason?: string; sessions: number; left: number | null;
  mark: number | null; markKind: 'live' | 'close' | null; pnl: number | null; r: number | null; pct: number | null; stopGap?: boolean; skipReason?: string;
  /** the signal close on the basis the bars are quoted in, and the share-count change applied when the bars were re-quoted after a split or bonus (1 = none) */
  signal?: number; adjFactor?: number; basis?: 'verified' | 'unverified';
}
/** The round-trip cost the planner and the tracker both assume until the published feed says otherwise. One number, so a plan and the trade that follows it agree. */
export const DEFAULT_COST = 0.25;
export const SLIPPAGE_PCT = 0.1;          // each side
export const GAP_SKIP_PCT = 2;
const r2 = (x: number) => Math.round(x * 100) / 100;

const istDate = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
/** Yahoo re-quotes the whole history after a split or bonus, so a signal close and stop stored in the old prices no longer line up with the bars: the stop would look
 *  breached (or the entry skipped) on the day of the split. The bar of the signal day carries the signal close in TODAY'S quoting, so the ratio of the two is the
 *  adjustment. Levels move to the bars' basis and the quantity moves the other way, so value, risk and P&L are what they were. A ratio within 0.6% is rounding. */
export function rebase(p: Paper, bars: readonly Bar[]): { p: Paper; factor: number; verified: boolean } {
  const day = bars.find((b) => istDate(b.t) === p.asOf);
  if (!day || !(p.ref > 0)) return { p, factor: 1, verified: false };
  const f = day.c / p.ref; if (Math.abs(f - 1) <= 0.006) return { p, factor: 1, verified: true };
  return { p: { ...p, ref: r2(p.ref * f), stop: r2(p.stop * f), qty: p.qty / f }, factor: f, verified: true };
}
export function evaluatePaper(p0: Paper, bars: readonly Bar[] | null, live: { px: number; t: number } | null, costRoundTripPct: number): View {
  const base: View = { id: p0.id, status: 'waiting', sessions: 0, left: p0.horizon, mark: null, markKind: null, pnl: null, r: null, pct: null };
  if (!bars || !bars.length) return base;
  const rb = rebase(p0, bars); const p = rb.p; base.signal = p.ref; base.adjFactor = rb.factor; base.basis = rb.verified ? 'verified' : 'unverified';
  const i0 = bars.findIndex((b) => b.t > p.takenAt);
  if (i0 < 0) return { ...base, status: 'pending' };
  const first = bars[i0];
  const fill = r2(first.o * (1 + SLIPPAGE_PCT / 100));        // a fill has paise precision; every figure below, and the what-if slider, uses this one number
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
