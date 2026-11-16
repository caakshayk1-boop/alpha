/** Read-only chart evidence. No engine, entry, exit or scoring rules depend on this module. */
import { aggregate, rsiSeries, smaSeries, type Pt } from './chart.ts';
export interface Divergence { kind: 'bullish' | 'bearish'; from: number; to: number; confirmed: number; priceFrom: number; priceTo: number; rsiFrom: number; rsiTo: number }
/** Strict close pivots, three bars on each side. A pair is available only after the second pivot's right-hand bars exist. */
export function confirmedDivergences(bars: readonly Pt[], period = 14, wing = 3): Divergence[] {
  const rs = rsiSeries(bars.map(p => p.c), period), out: Divergence[] = [];
  for (const kind of ['bullish', 'bearish'] as const) {
    let prev: number | null = null;
    for (let i = wing; i + wing < bars.length; i++) {
      if (rs[i] == null) continue;
      const pivot = bars.slice(i - wing, i + wing + 1).every((p, j) => j === wing || (kind === 'bullish' ? p.c > bars[i].c : p.c < bars[i].c));
      if (!pivot) continue;
      if (prev != null && i - prev <= 60 && (kind === 'bullish' ? bars[i].c < bars[prev].c && rs[i]! > rs[prev]! : bars[i].c > bars[prev].c && rs[i]! < rs[prev]!)) out.push({ kind, from: bars[prev].t, to: bars[i].t, confirmed: bars[i + wing].t, priceFrom: bars[prev].c, priceTo: bars[i].c, rsiFrom: rs[prev]!, rsiTo: rs[i]! });
      prev = i;
    }
  }
  return out.sort((a, b) => a.confirmed - b.confirmed);
}
export function evidenceAt(all: readonly Pt[], at: number, period = 14) {
  const pts = all.filter(p => p.t <= at), last = pts.at(-1);
  if (!last) return null;
  const avg = (n: number) => smaSeries(pts, n).at(-1) ?? null;
  const ma20 = avg(20), ma50 = avg(50), ma200 = avg(200);
  const high = pts[0].t > last.t - (365.25 - 7) * 86400 ? null : Math.max(...pts.filter(p => p.t >= last.t - 365.25 * 86400).map(p => p.c));
  const momentum = (['daily', 'weekly', 'monthly'] as const).map(frame => ({ frame, value: rsiSeries(aggregate(pts, frame).map(p => p.c), period).at(-1) ?? null }));
  return { at: last.t, close: last.c, ma20, ma50, ma200, high, fromHigh: high == null ? null : (last.c / high - 1) * 100,
    trend: ma50 == null || ma200 == null ? 'Unmeasured' : last.c > ma50 && ma50 > ma200 ? 'Uptrend' : last.c < ma50 && ma50 < ma200 ? 'Downtrend' : 'Mixed', momentum };
}
