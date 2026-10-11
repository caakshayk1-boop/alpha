/** Plain technical-analysis helpers for the chart. Every value at bar i uses bars <= i only. */
export interface Bars { t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[]; nifty: (number | null)[] }

export const sma = (x: number[], n: number): (number | null)[] => {
  const out: (number | null)[] = [];
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    s += x[i];
    if (i >= n) s -= x[i - n];
    out.push(i >= n - 1 ? s / n : null);
  }
  return out;
};

export const rsi = (c: number[], n = 14): (number | null)[] => {
  const out: (number | null)[] = Array(c.length).fill(null);
  if (c.length <= n) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= n; l /= n;
  out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = n + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    l = (l * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
};

export const atr = (b: Bars, n = 14): number | null => {
  if (b.c.length <= n) return null;
  let s = 0;
  for (let i = b.c.length - n; i < b.c.length; i++) s += Math.max(b.h[i] - b.l[i], Math.abs(b.h[i] - b.c[i - 1]), Math.abs(b.l[i] - b.c[i - 1]));
  return s / n;
};

export interface Level { price: number; touches: number; kind: 'support' | 'resistance' }

/** Swing highs and lows (5 bars each side), merged when within 1.5%, kept when touched at least twice. The five nearest to the last close. */
export const levels = (b: Bars): Level[] => {
  const w = 5, pts: number[] = [];
  for (let i = w; i < b.c.length - w; i++) {
    let hi = true, lo = true;
    for (let k = 1; k <= w; k++) {
      if (b.h[i] < b.h[i - k] || b.h[i] < b.h[i + k]) hi = false;
      if (b.l[i] > b.l[i - k] || b.l[i] > b.l[i + k]) lo = false;
    }
    if (hi) pts.push(b.h[i]);
    if (lo) pts.push(b.l[i]);
  }
  pts.sort((a, z) => a - z);
  const cl: { sum: number; n: number }[] = [];
  for (const p of pts) {
    const last = cl[cl.length - 1];
    if (last && p / (last.sum / last.n) - 1 < 0.015) { last.sum += p; last.n++; } else cl.push({ sum: p, n: 1 });
  }
  const px = b.c[b.c.length - 1];
  return cl.filter((c) => c.n >= 2).map((c) => ({ price: c.sum / c.n, touches: c.n, kind: (c.sum / c.n >= px ? 'resistance' : 'support') as Level['kind'] }))
    .sort((a, z) => Math.abs(a.price - px) - Math.abs(z.price - px)).slice(0, 5);
};
