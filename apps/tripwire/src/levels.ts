/** The price lines a chart can draw for a name: where a paper pick was filed, its stop and its two targets.
 *
 *  ONE R. Once a pick has ENTERED, R is the fill minus the stop and the targets are the fill plus 1.5R / 3R (or the style's multiples): exactly the prices the tracker books
 *  (`ladderPrices` in exits.ts is the one definition both use). Before it has entered there is no fill, so the levels are worked from the signal close and are labelled
 *  "at signal close"; they move by the gap between that close and the next open. Signal-close levels are never shown beside an entered position. */
import { ladderPrices, styleDef, styleOf, targetsFor } from './exits.ts';

export interface Level { label: string; v: number; kind: 'signal' | 'stop' | 'target'; ref?: boolean }
interface PickLike { sym: string; asOf: string; horizon: number; ref: number; stop: number; /** the position has finished (closed or skipped); an earlier pick that finished before the backfill keeps reference-only levels */ final?: boolean;
  /** the fill, once the pick has entered (from the ledger's outcome); absent while it is waiting for its open */ entry?: number | null }

const r2 = (x: number) => Math.round(x * 100) / 100;
export type LevelBasis = 'entry' | 'signal';

/** The two profit-booking prices for a pick. With `entry` (the fill) they are the booked ones, basis 'entry'. Without it they are worked from the signal close, basis 'signal', and the screen must say "at signal close".
 *  `ref` is true when the pick finished before the ladder was extended to it (see TARGETS_BACKFILL_ON), so the prices are shown for orientation and never traded. */
export function targetPrices(p: { asOf: string; horizon: number; ref: number; stop: number }, final = false, entry?: number | null): { t1: number; t2: number; ref: boolean; basis: LevelBasis } | null {
  const base = entry != null && entry > p.stop ? entry : p.ref; const basis: LevelBasis = base === entry ? 'entry' : 'signal';
  if (!(base > p.stop) || !(p.stop > 0)) return null; const t = targetsFor(p, final); const sd = styleDef(styleOf(p.horizon));
  const x = ladderPrices(base, p.stop, t ? t.t1R : sd.t1, t ? t.t2R : sd.t2);
  return { t1: x.t1, t2: x.t2, ref: !t, basis };
}
export const BASIS_NOTE: Record<LevelBasis, string> = { entry: 'from the fill', signal: 'at signal close' };

export function levelsFor(sym: string, picks: readonly PickLike[]): Level[] {
  const p = picks.filter((x) => x.sym === sym && x.ref > x.stop && x.stop > 0).sort((a, b) => (a.asOf < b.asOf ? 1 : -1))[0];
  if (!p) return [];
  const t = targetPrices(p, p.final, p.entry); if (!t) return [];
  const sfx = t.ref ? ' ref' : ''; const note = t.basis === 'signal' ? ' at signal close' : '';
  const head: Level[] = t.basis === 'entry' ? [{ label: 'Entry', v: r2(p.entry!), kind: 'signal' }] : [{ label: 'Signal close', v: r2(p.ref), kind: 'signal' }];
  return [...head, { label: 'Stop', v: r2(p.stop), kind: 'stop' },
    { label: `T1${sfx}${note}`, v: t.t1, kind: 'target', ...(t.ref ? { ref: true } : {}) }, { label: `T2${sfx}${note}`, v: t.t2, kind: 'target', ...(t.ref ? { ref: true } : {}) }];   // a finished earlier pick: orientation only
}
