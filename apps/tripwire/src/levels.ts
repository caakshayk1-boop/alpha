/** The price lines a chart can draw for a name: where a paper pick was filed, its stop and its two targets.
 *  Taken from the pick as written (the signal close and the stop), because the fill happens at the next open and is not known yet:
 *  the targets are the signal close plus the style's multiples of risk, so they move by the gap between the close and the fill. */
import { targetsFor } from './exits.ts';

export interface Level { label: string; v: number; kind: 'signal' | 'stop' | 'target' }
interface PickLike { sym: string; asOf: string; horizon: number; ref: number; stop: number }

const r2 = (x: number) => Math.round(x * 100) / 100;

export function levelsFor(sym: string, picks: readonly PickLike[]): Level[] {
  const p = picks.filter((x) => x.sym === sym && x.ref > x.stop && x.stop > 0).sort((a, b) => (a.asOf < b.asOf ? 1 : -1))[0];
  if (!p) return [];
  const out: Level[] = [{ label: 'Signal close', v: r2(p.ref), kind: 'signal' }, { label: 'Stop', v: r2(p.stop), kind: 'stop' }];
  const t = targetsFor(p);
  if (t) { const risk = p.ref - p.stop; out.push({ label: 'T1', v: r2(p.ref + t.t1R * risk), kind: 'target' }, { label: 'T2', v: r2(p.ref + t.t2R * risk), kind: 'target' }); }
  return out;
}
