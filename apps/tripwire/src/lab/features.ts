/** Price-only figures the Lab can test, recomputed from closes. They carry the same names and units as Discover's figures (percent, 0 or below for the
 *  distance from the high) so a condition built in one reads the same in the other. Each returns null when the history is too short: a missing figure
 *  never passes a condition. The screen's own RSI, returns and averages are built the same way but from its own bars, so a name can sit a hair either side
 *  of a threshold here and there. This is a test of the RULE's shape, not a replay of the screen. */
import type { MetricKey } from '../screener.ts';
import type { LabPanel } from './panel.ts';

export const LAB_KEYS: MetricKey[] = ['r1w', 'r1m', 'r3m', 'r6m', 'r1y', 'rs3m', 'dist20', 'dist50', 'dist200', 'from_high', 'from_low', 'sd1y', 'rsi'];
const WIN: Record<string, number> = { r1w: 5, r1m: 21, r3m: 63, r6m: 126, r1y: 252 };

export interface Ctx { p: LabPanel; ps: Float64Array; ew: Float64Array; ewCum: Float64Array }
/** Prefix sums of every close (so any average is two reads) and the equal-weight universe's daily return and cumulative value. */
export function makeCtx(p: LabPanel): Ctx {
  const { N, T, C } = p; const ps = new Float64Array(N * (T + 1)); const ew = new Float64Array(T), ewCum = new Float64Array(T); ewCum[0] = 1;
  for (let j = 0; j < N; j++) { let a = 0; for (let i = 0; i < T; i++) { const v = C[j * T + i]; a += Number.isNaN(v) ? 0 : v; ps[j * (T + 1) + i + 1] = a; } }
  // the equal-weight universe, rebalanced every five sessions (a daily rebalance of a noisy universe pays a return nobody could collect)
  let base = 0; for (let i = 1; i < T; i++) {
    if ((i - 1) % 5 === 0) base = i - 1;
    let s = 0, n = 0; for (let j = 0; j < N; j++) { const a = C[j * T + base], b = C[j * T + i], pv = C[j * T + i - 1]; if (a > 0 && b > 0) { s += b / a - 1; n++; } void pv; }
    ewCum[i] = ewCum[base] * (1 + (n ? s / n : 0)); ew[i] = ewCum[i] / ewCum[i - 1] - 1;
  }
  return { p, ps, ew, ewCum };
}

const ok = (p: LabPanel, j: number, i: number, back: number) => i - back >= p.first[j] && i - back >= 0;
const px = (p: LabPanel, j: number, i: number) => p.C[j * p.T + i];

export function feature(c: Ctx, key: MetricKey, j: number, i: number): number | null {
  const p = c.p, T = p.T; const now = px(p, j, i); if (!(now > 0)) return null;
  const w = WIN[key];
  if (w) { if (!ok(p, j, i, w)) return null; const then = px(p, j, i - w); return then > 0 ? (now / then - 1) * 100 : null; }
  if (key === 'rs3m') { const r = feature(c, 'r3m', j, i); if (r === null || i < 63) return null; return r - (c.ewCum[i] / c.ewCum[i - 63] - 1) * 100; }
  if (key === 'dist20' || key === 'dist50' || key === 'dist200') {
    const n = key === 'dist20' ? 20 : key === 'dist50' ? 50 : 200; if (!ok(p, j, i, n - 1)) return null;
    const avg = (c.ps[j * (T + 1) + i + 1] - c.ps[j * (T + 1) + i + 1 - n]) / n; return avg > 0 ? (now / avg - 1) * 100 : null;
  }
  if (key === 'from_high' || key === 'from_low') {
    if (!ok(p, j, i, 251)) return null; let hi = -Infinity, lo = Infinity;
    for (let k = i - 251; k <= i; k++) { const v = px(p, j, k); if (v > hi) hi = v; if (v < lo) lo = v; }
    return key === 'from_high' ? (now / hi - 1) * 100 : (now / lo - 1) * 100;
  }
  if (key === 'sd1y') {
    if (!ok(p, j, i, 252)) return null; let s = 0, s2 = 0; for (let k = i - 251; k <= i; k++) { const r = px(p, j, k) / px(p, j, k - 1) - 1; s += r; s2 += r * r; }
    const m = s / 252; return Math.sqrt(Math.max(0, (s2 - 252 * m * m) / 251)) * Math.sqrt(252) * 100;
  }
  if (key === 'rsi') {                                  // Wilder, seeded 60 sessions back
    if (!ok(p, j, i, 60)) return null; let g = 0, l = 0;
    for (let k = i - 59; k <= i; k++) { const d = px(p, j, k) - px(p, j, k - 1); const up = d > 0 ? d : 0, dn = d < 0 ? -d : 0; if (k < i - 45) { g += up / 14; l += dn / 14; } else { g = (g * 13 + up) / 14; l = (l * 13 + dn) / 14; } }
    return l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l);
  }
  return null;
}
