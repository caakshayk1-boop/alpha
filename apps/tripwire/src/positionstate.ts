/** Position state is independent of today's candidate list and model settings. A failed or truncated price fetch is not an exit. */
import { evaluatePaper, SLIPPAGE_PCT, type Bar, type Paper, type View } from './tracker.ts';
import type { Outcome } from './ledger.ts';
import { covered, nextSession } from './calendar.ts';
import { ladderPrices } from './exits.ts';

const day = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
const time = (d?: string) => d ? Date.parse(`${d}T03:45:00Z`) / 1000 : undefined;
export function outcomeView(p: Paper, o?: Outcome): View | undefined {
  if (!o || !['open', 'closed', 'skipped'].includes(o.status)) return undefined;
  if (o.status === 'skipped') return { id: p.id, status: 'skipped', sessions: 0, left: null, mark: null, markKind: null, pnl: null, r: null, pct: null, skipReason: o.skipReason };
  if (!(Number.isFinite(o.entry) && o.entry! > 0) || !Number.isFinite(time(o.entryDay))) return undefined;
  const levels = p.targets ? ladderPrices(o.entry!, p.stop, p.targets.t1R, p.targets.t2R) : null;
  const half = Math.floor(p.qty / 2);
  return { id: p.id, status: o.status as 'open' | 'closed', entry: o.entry, entryT: time(o.entryDay), exit: o.exit, exitT: time(o.exitDay), reason: o.reason,
    sessions: o.sessions ?? 0, left: o.final ? 0 : Math.max(0, p.horizon - (o.sessions ?? 0)), mark: o.final ? o.exit ?? null : o.mark ?? null, markKind: 'close',
    pnl: o.pct == null ? null : Math.round(o.pct / 100 * o.entry! * p.qty * 100) / 100, r: o.r ?? null, pct: o.pct ?? null,
    ...(levels ? { ladder: { ...levels, t1Hit: !!o.t1Hit, t2Hit: !!o.t2Hit, qtyLeft: o.final ? 0 : o.t1Hit ? p.qty - half : p.qty, booked: o.t1Hit && o.t1Px != null ? (o.t1Px - o.entry!) * half : 0, stop: o.t1Hit ? o.entry! : p.stop, t1T: time(o.t1Day), t1Px: o.t1Px, t2T: time(o.t2Day), t2Px: o.t2Px } } : {}),
    dataNote: `Last recorded state${o.markDay ? ` · ${o.markDay}` : ''}. Waiting for complete daily prices.` };
}
const r2 = (v: number) => Math.round(v * 100) / 100;
/** A retained position marked to the live price. The history is incomplete, so nothing about the position's STATE changes (entry, targets filled, shares left all stay as recorded), but its price and P&L follow the market
 *  by the tracker's own open-position formula. It can never close a position: a live print is never an exit. A print more than 60% away from the entry is a bad tick and is ignored. */
/** The widest move from the last recorded mark that is still read as a market move. Beyond it the price may be on a different basis (a split or a bonus halves it; the recorded entry and share count would not follow), so the recorded price is kept until the daily history confirms the basis. */
export const LIVE_BAND = 0.25;
export function livePlausible(prior: View, live: { px: number } | null): boolean {
  const ref = prior.mark && prior.mark > 0 ? prior.mark : prior.entry; return !!live && live.px > 0 && !!ref && live.px / ref >= 1 - LIVE_BAND && live.px / ref <= 1 + LIVE_BAND;
}
export function markOpen(prior: View, p: Paper, live: { px: number; t: number } | null, cost: number): View {
  if (prior.status !== 'open' || !live || !(live.px > 0) || !(prior.entry && prior.entry > 0) || Math.abs(live.px / prior.entry - 1) > 0.6 || !livePlausible(prior, live)) return prior;
  const fill = prior.entry; const left = prior.ladder ? prior.ladder.qtyLeft : p.qty; const booked = prior.ladder?.booked ?? 0;
  const pnl = booked + (live.px - fill) * left - (cost / 100) * fill * p.qty - (SLIPPAGE_PCT / 100) * live.px * left; const risk = fill - p.stop;
  return { ...prior, mark: r2(live.px), markKind: 'live', pnl: r2(pnl), r: risk > 0 ? r2(pnl / (risk * p.qty)) : prior.r, pct: r2((pnl / (fill * p.qty)) * 100) };
}
export function preservePosition(p: Paper, bars: readonly Bar[] | null, live: { px: number; t: number } | null, cost: number, previous?: View): View {
  const prior = previous?.id === p.id && ['open', 'closed', 'skipped'].includes(previous.status) && (previous.status === 'skipped' || Number.isFinite(previous.entryT) && Number.isFinite(previous.entry) && previous.entry! > 0) ? previous : undefined;
  if (prior?.status === 'closed' || prior?.status === 'skipped') return prior;
  const valid = !!bars?.length && bars.every((b, i) => [b.t, b.o, b.h, b.l, b.c].every(Number.isFinite) && b.o > 0 && b.l > 0 && b.h >= Math.max(b.o, b.c, b.l) && b.l <= Math.min(b.o, b.c) && (!i || b.t > bars[i - 1].t));
  const keep = (why: string): View => {
    const marked = markOpen(prior!, p, live, cost); const held = prior!.status === 'open' && !!live && live.px > 0 && marked === prior;
    return { ...marked, dataNote: held && !livePlausible(prior!, live) ? `${why} The live price is more than ${Math.round(LIVE_BAND * 100)}% from the recorded price, which can be a split or bonus, so the recorded price is kept until the daily history confirms it. Position retained; no exit was triggered.` : marked !== prior ? `${why} Position retained; priced from the live quote; no exit was triggered.` : `${why} Position retained; no exit was triggered.` };
  };
  if (prior && (!valid || !bars!.some((b) => day(b.t) === p.asOf))) return keep('Daily history is missing or incomplete.');
  if (prior && covered(p.asOf)) {
    const days = new Set(bars!.map((b) => day(b.t))); const end = day(bars![bars!.length - 1].t);
    for (let d = nextSession(p.asOf); d <= end; d = nextSession(d)) if (!days.has(d)) return keep(`Daily history is missing session ${d}.`);
  }
  const v = evaluatePaper(p, valid ? bars : null, live, cost);
  if (prior && (v.status === 'waiting' || v.status === 'pending' || v.status === 'skipped' || !v.entryT || day(v.entryT) !== day(prior.entryT!))) return keep('The returned history cannot confirm the recorded entry.');
  if (prior && v.sessions < prior.sessions) return keep('The returned history ends before the recorded position state.');
  if (prior?.ladder?.t1Hit && !v.ladder?.t1Hit) return keep('The returned history cannot confirm the recorded partial exit.');
  return v;
}
