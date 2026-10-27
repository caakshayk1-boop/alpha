/** The price lines a chart can draw for a name: where a paper pick was filed, its stop and its two targets.
 *  Taken from the pick as written (the signal close and the stop), because the fill happens at the next open and is not known yet:
 *  the targets are the signal close plus the style's multiples of risk, so they move by the gap between the close and the fill. */
import { styleDef, styleOf, targetsFor } from './exits.ts';

export interface Level { label: string; v: number; kind: 'signal' | 'stop' | 'target'; ref?: boolean }
interface PickLike { sym: string; asOf: string; horizon: number; ref: number; stop: number }

const r2 = (x: number) => Math.round(x * 100) / 100;

/** The two profit-booking prices for a pick, from its signal close and stop: `ref` is true when the pick was filed before profit booking began, so the prices are shown for orientation and never traded. */
export function targetPrices(p: { asOf: string; horizon: number; ref: number; stop: number }): { t1: number; t2: number; ref: boolean } | null {
  if (!(p.ref > p.stop) || !(p.stop > 0)) return null; const risk = p.ref - p.stop; const t = targetsFor(p); const sd = styleDef(styleOf(p.horizon));
  return t ? { t1: r2(p.ref + t.t1R * risk), t2: r2(p.ref + t.t2R * risk), ref: false } : { t1: r2(p.ref + sd.t1 * risk), t2: r2(p.ref + sd.t2 * risk), ref: true };
}
export function levelsFor(sym: string, picks: readonly PickLike[]): Level[] {
  const p = picks.filter((x) => x.sym === sym && x.ref > x.stop && x.stop > 0).sort((a, b) => (a.asOf < b.asOf ? 1 : -1))[0];
  if (!p) return [];
  const out: Level[] = [{ label: 'Signal close', v: r2(p.ref), kind: 'signal' }, { label: 'Stop', v: r2(p.stop), kind: 'stop' }];
  const t = targetsFor(p); const risk = p.ref - p.stop;
  if (t) out.push({ label: 'T1', v: r2(p.ref + t.t1R * risk), kind: 'target' }, { label: 'T2', v: r2(p.ref + t.t2R * risk), kind: 'target' });
  else { const sd = styleDef(styleOf(p.horizon)); out.push({ label: 'T1 ref', v: r2(p.ref + sd.t1 * risk), kind: 'target', ref: true }, { label: 'T2 ref', v: r2(p.ref + sd.t2 * risk), kind: 'target', ref: true }); }   // filed before profit booking began: orientation only
  return out;
}
