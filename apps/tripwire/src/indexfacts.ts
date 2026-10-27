/** What an index quote says about the day, from its own five-minute closes. Pure. Every figure is today's session; none is a forecast.
 *  `pos` is where the last price sits inside the day's range (0 = at the low, 1 = at the high); `prevPos` is where yesterday's close sits in the same range, or null when it is outside it. */
export interface IndexFacts { px: number; prev: number; pts: number; ch: number; lo: number; hi: number; open: number | null; gap: number | null; pos: number | null; prevPos: number | null; rangePct: number | null; bars: number }
const r2 = (x: number) => Math.round(x * 100) / 100;
export function indexFacts(q: { c: number[]; px: number; prev: number } | null | undefined): IndexFacts | null {
  if (!q || !(q.px > 0) || !(q.prev > 0)) return null;
  const all = [...q.c.filter((v) => v > 0), q.px]; const lo = Math.min(...all), hi = Math.max(...all); const span = hi - lo;
  const open = q.c.length ? q.c[0] : null;
  return { px: q.px, prev: q.prev, pts: r2(q.px - q.prev), ch: (q.px / q.prev - 1) * 100, lo, hi, open, gap: open != null ? (open / q.prev - 1) * 100 : null,
    pos: span > 0 ? (q.px - lo) / span : null, prevPos: span > 0 && q.prev >= lo && q.prev <= hi ? (q.prev - lo) / span : null, rangePct: lo > 0 ? (span / lo) * 100 : null, bars: q.c.length };
}
/** Bank Nifty's move minus Nifty's, in percentage points: positive means the banks are leading the index today. */
export const bankLead = (bank: number | null, nifty: number | null) => (bank == null || nifty == null ? null : Math.round((bank - nifty) * 100) / 100);
