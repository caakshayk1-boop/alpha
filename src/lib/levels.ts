/** Levels for one instrument from a year of daily bars (/api/instrument): the figures the Markets detail sheet shows.
 *  Standard definitions only, nothing forecast:
 *    averages   simple 20, 50 and 200-day averages of the close
 *    pivots     classic floor pivots from the last COMPLETE session: P = (H + L + C) / 3, R1 = 2P - L, S1 = 2P - H,
 *               R2 = P + (H - L), S2 = P - (H - L)
 *    range      52-week high and low of the daily highs and lows, with their dates
 *    typical    average daily range (high - low) over 14 sessions, as % of the close
 *    volatility standard deviation of daily returns over 20 sessions, annualised (x sqrt 252)
 *  Pure functions only: tested in tests/lib.test.ts. */

export interface Bars { t: number[]; o: number[]; h: number[]; l: number[]; c: number[] }
export interface Level { label: string; value: number; kind: 'pivot' | 'average' | 'range' }
export interface Levels {
  last: number;
  sma20: number | null; sma50: number | null; sma200: number | null;
  hi52: { v: number; t: number } | null; lo52: { v: number; t: number } | null;
  /** where `price` sits in the 52-week range, 0 (low) to 100 (high) */
  pos52: number | null;
  fromHigh: number | null;
  ret: { w1: number | null; m1: number | null; m3: number | null; ytd: number | null; y1: number | null };
  pivots: { p: number; r1: number; r2: number; s1: number; s2: number; from: number } | null;
  rangePct: number | null;
  vol20: number | null;
  /** consecutive closes in one direction up to the last bar: +3 = three up closes */
  streak: number;
  best: { pct: number; t: number } | null; worst: { pct: number; t: number } | null;
  /** every level, sorted high to low, for the ladder */
  ladder: Level[];
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const sma = (c: number[], n: number) => (c.length >= n ? avg(c.slice(-n)) : null);
const pct = (a: number | null | undefined, b: number | null | undefined) => (a && b ? (a / b - 1) * 100 : null);
const ist = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);

/** `price` is the latest price (live or close). `sessionOpen` is true when the last bar is the session still trading, so the
 *  pivots come from the bar before it. */
export function levels(b: Bars, price: number | null | undefined, sessionOpen = false): Levels | null {
  const n = b.c.length;
  if (n < 20) return null;
  const last = typeof price === 'number' && price > 0 ? price : b.c[n - 1];
  const closes = sessionOpen ? [...b.c.slice(0, -1), last] : b.c;
  const yr = Math.max(0, n - 252);
  let hi = { v: -Infinity, t: 0 }, lo = { v: Infinity, t: 0 };
  for (let i = yr; i < n; i++) { if (b.h[i] > hi.v) hi = { v: b.h[i], t: b.t[i] }; if (b.l[i] < lo.v) lo = { v: b.l[i], t: b.t[i] }; }
  const hi52 = Number.isFinite(hi.v) ? hi : null, lo52 = Number.isFinite(lo.v) ? lo : null;
  const pi = sessionOpen ? n - 2 : n - 1;
  const pivots = pi >= 0 ? (() => { const H = b.h[pi], L = b.l[pi], C = b.c[pi], P = (H + L + C) / 3; return { p: P, r1: 2 * P - L, s1: 2 * P - H, r2: P + (H - L), s2: P - (H - L), from: b.t[pi] }; })() : null;
  const back = (k: number) => (closes.length > k ? closes[closes.length - 1 - k] : null);
  const year = ist(b.t[n - 1]).slice(0, 4);
  const firstThisYear = b.t.findIndex((t) => ist(t).slice(0, 4) === year);
  const ytdBase = firstThisYear > 0 ? b.c[firstThisYear - 1] : null;
  const rets = closes.slice(1).map((c, i) => c / closes[i] - 1);
  const r20 = rets.slice(-20);
  const sd = r20.length >= 10 ? Math.sqrt(avg(r20.map((x) => (x - avg(r20)) ** 2))) : null;
  let streak = 0;
  for (let i = closes.length - 1; i > 0; i--) {
    const d = Math.sign(closes[i] - closes[i - 1]);
    if (d === 0 || (streak !== 0 && Math.sign(streak) !== d)) break;
    streak += d;
  }
  let best: Levels['best'] = null, worst: Levels['worst'] = null;
  for (let i = Math.max(1, n - 252); i < n; i++) {
    const r = (b.c[i] / b.c[i - 1] - 1) * 100;
    if (!best || r > best.pct) best = { pct: r, t: b.t[i] };
    if (!worst || r < worst.pct) worst = { pct: r, t: b.t[i] };
  }
  const sma20 = sma(closes, 20), sma50 = sma(closes, 50), sma200 = sma(closes, 200);
  const ladder: Level[] = [
    ...(pivots ? [{ label: 'R2', value: pivots.r2, kind: 'pivot' as const }, { label: 'R1', value: pivots.r1, kind: 'pivot' as const }, { label: 'Pivot', value: pivots.p, kind: 'pivot' as const }, { label: 'S1', value: pivots.s1, kind: 'pivot' as const }, { label: 'S2', value: pivots.s2, kind: 'pivot' as const }] : []),
    ...(sma20 ? [{ label: '20-day avg', value: sma20, kind: 'average' as const }] : []),
    ...(sma50 ? [{ label: '50-day avg', value: sma50, kind: 'average' as const }] : []),
    ...(sma200 ? [{ label: '200-day avg', value: sma200, kind: 'average' as const }] : []),
    ...(hi52 ? [{ label: '52-week high', value: hi52.v, kind: 'range' as const }] : []),
    ...(lo52 ? [{ label: '52-week low', value: lo52.v, kind: 'range' as const }] : []),
  ].sort((x, y) => y.value - x.value);
  const range14 = b.h.slice(-14).map((h, i) => (h - b.l.slice(-14)[i]) / b.c.slice(-14)[i]);
  return {
    last, sma20, sma50, sma200, hi52, lo52,
    pos52: hi52 && lo52 && hi52.v > lo52.v ? Math.max(0, Math.min(100, ((last - lo52.v) / (hi52.v - lo52.v)) * 100)) : null,
    fromHigh: hi52 ? pct(last, hi52.v) : null,
    ret: { w1: pct(last, back(5)), m1: pct(last, back(21)), m3: pct(last, back(63)), ytd: pct(last, ytdBase), y1: n >= 250 ? pct(last, back(Math.min(251, closes.length - 1))) : null },
    pivots, rangePct: range14.length ? avg(range14) * 100 : null, vol20: sd === null ? null : sd * Math.sqrt(252) * 100,
    streak, best, worst, ladder,
  };
}

/** One plain sentence per notable fact, most notable first, at most four. Facts, never a call. */
export function highlights(lv: Levels): string[] {
  const out: [number, string][] = [];
  if (lv.fromHigh !== null && lv.fromHigh > -1) out.push([10, 'Within 1% of its 52-week high']);
  else if (lv.fromHigh !== null && lv.fromHigh < -20) out.push([8, `${Math.abs(lv.fromHigh).toFixed(0)}% below its 52-week high`]);
  if (lv.pos52 !== null && lv.pos52 < 5) out.push([9, 'Near the bottom of its 52-week range']);
  if (Math.abs(lv.streak) >= 3) out.push([7, `${Math.abs(lv.streak)} ${lv.streak > 0 ? 'higher' : 'lower'} closes in a row`]);
  if (lv.sma50 && lv.sma200) {
    const a50 = lv.last > lv.sma50, a200 = lv.last > lv.sma200;
    out.push([6, a50 && a200 ? 'Above its 50- and 200-day averages' : !a50 && !a200 ? 'Below its 50- and 200-day averages' : a200 ? 'Below its 50-day but above its 200-day average' : 'Above its 50-day but below its 200-day average']);
  }
  if (lv.ret.m1 !== null && Math.abs(lv.ret.m1) >= 5) out.push([5, `${lv.ret.m1 > 0 ? 'Up' : 'Down'} ${Math.abs(lv.ret.m1).toFixed(1)}% in a month`]);
  if (lv.rangePct !== null) out.push([2, `Typical day spans ${lv.rangePct.toFixed(1)}% high to low`]);
  return out.sort((a, b) => b[0] - a[0]).slice(0, 4).map((x) => x[1]);
}
