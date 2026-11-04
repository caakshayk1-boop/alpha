/** What an open position is doing, in figures and one plain line. Pure: it reads a position's view and says nothing the figures do not. It describes; it never advises, forecasts or says "buy", "sell" or "hold".
 *  Distances are measured from the price the position is marked at, so they move as the price does. The stop and the targets are the position's own recorded levels (after a first target fills, the stop is at the entry). */
import type { View, Paper } from './tracker.ts';
export interface PosInsight {
  /** how far above the stop the mark is, as a share of the mark; negative would mean through it */
  stopPct: number | null; stop: number | null;
  /** the next profit target not yet filled, and how far the mark is from it */
  nextTarget: { label: 'T1' | 'T2'; px: number; pct: number } | null;
  r: number | null; sessionsLeft: number | null; badges: string[]; line: string;
}
const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const inr = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: v < 1000 ? 2 : 0, maximumFractionDigits: 2 })}`;
export function positionInsight(v: View, p: Pick<Paper, 'stop' | 'horizon'>): PosInsight | null {
  if (v.status !== 'open' || !(v.mark && v.mark > 0) || !(v.entry && v.entry > 0)) return null;
  const mark = v.mark; const stop = v.ladder?.stop ?? p.stop; const stopPct = stop > 0 ? ((mark - stop) / mark) * 100 : null;
  const nextTarget = v.ladder && !v.ladder.t1Hit ? { label: 'T1' as const, px: v.ladder.t1, pct: (v.ladder.t1 / mark - 1) * 100 }
    : v.ladder && !v.ladder.t2Hit ? { label: 'T2' as const, px: v.ladder.t2, pct: (v.ladder.t2 / mark - 1) * 100 } : null;
  const sessionsLeft = typeof v.left === 'number' ? v.left : null; const r = typeof v.r === 'number' ? v.r : null;
  const badges: string[] = []; if (v.ladder?.t1Hit) badges.push('T1 filled'); if (stopPct != null && stopPct <= 0) badges.push('Through the stop'); else if (stopPct != null && stopPct < 3) badges.push('Near the stop'); if (sessionsLeft != null && sessionsLeft <= 2) badges.push('Time limit close');
  const parts: string[] = [];
  // A live mark can sit at or through the stop while the daily bars have not confirmed an exit; say so, and say that no exit is recorded, rather than call it a distance above.
  if (stopPct != null && stopPct <= 0) parts.push(`${stopPct === 0 ? 'At' : `${r1(-stopPct)}% below`} the stop (${inr(stop)}). No exit is recorded yet; the tracker confirms exits from the daily bars.`);
  else if (stopPct != null && stopPct < 3) parts.push(`Close to the stop: ${r1(stopPct)}% above ${inr(stop)}.`);
  else if (r != null && r < 0) parts.push(`Below entry (${r1(r)}R), ${stopPct != null ? `${r1(stopPct)}% above the stop` : 'stop not set'}.`);
  else if (r != null) parts.push(`Above entry (${r >= 0 ? '+' : ''}${r1(r)}R)${stopPct != null ? `, ${r1(stopPct)}% above the stop` : ''}.`);
  if (nextTarget) parts.push(nextTarget.pct > 0 ? `${r1(nextTarget.pct)}% to ${nextTarget.label} (${inr(nextTarget.px)}).` : `${nextTarget.label} (${inr(nextTarget.px)}) is below the price; its fill is not confirmed until the daily bars record it.`);
  else if (v.ladder?.t1Hit && v.ladder?.t2Hit) parts.push('Both targets have filled.');
  if (sessionsLeft != null) parts.push(`${sessionsLeft} session${sessionsLeft === 1 ? '' : 's'} left on its time limit.`);
  return { stopPct, stop, nextTarget, r, sessionsLeft, badges, line: parts.join(' ') };
}
