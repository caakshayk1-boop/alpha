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

export interface KeyLine { line: (number | null)[]; dir: (1 | -1 | 0)[]; since: number }

/** The key line: an ATR-based trailing line (SuperTrend, 10 bars, 3 ATR). Below price while the trend is up, above it while down.
 *  It only ever moves in the trend's favour and flips when the close crosses it, so it answers one question: up or down? */
export const keyLine = (b: Bars, n = 10, mult = 3): KeyLine => {
  const len = b.c.length;
  const line: (number | null)[] = Array(len).fill(null);
  const dir: (1 | -1 | 0)[] = Array(len).fill(0);
  if (len <= n + 1) return { line, dir, since: -1 };
  const tr = (i: number) => Math.max(b.h[i] - b.l[i], Math.abs(b.h[i] - b.c[i - 1]), Math.abs(b.l[i] - b.c[i - 1]));
  let a = 0;
  for (let i = 1; i <= n; i++) a += tr(i);
  a /= n;
  let fu = 0, fl = 0, d: 1 | -1 = 1;
  for (let i = n; i < len; i++) {
    if (i > n) a = (a * (n - 1) + tr(i)) / n;
    const mid = (b.h[i] + b.l[i]) / 2, bu = mid + mult * a, bl = mid - mult * a;
    if (i === n) { fu = bu; fl = bl; d = b.c[i] >= mid ? 1 : -1; }
    else {
      const pfu = fu, pfl = fl;
      fu = bu < pfu || b.c[i - 1] > pfu ? bu : pfu;
      fl = bl > pfl || b.c[i - 1] < pfl ? bl : pfl;
      if (d === -1 && b.c[i] > pfu) d = 1;
      else if (d === 1 && b.c[i] < pfl) d = -1;
    }
    line[i] = d === 1 ? fl : fu;
    dir[i] = d;
  }
  let since = len - 1;
  while (since > 0 && dir[since - 1] === dir[len - 1]) since--;
  return { line, dir, since };
};

/** Simulated price paths: resample the stock's own daily returns. Returns percentile bands per step and path-touch odds. */
export const cone = (c: number[], days: number, paths = 3000, keepDrift = false, seed = 7) => {
  const r: number[] = [];
  for (let i = 1; i < c.length; i++) r.push(Math.log(c[i] / c[i - 1]));
  if (r.length < 60) return null;
  const mean = r.reduce((a, x) => a + x, 0) / r.length;
  const x = keepDrift ? r : r.map((v) => v - mean);
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const p0 = c[c.length - 1];
  const grid: number[][] = Array.from({ length: days + 1 }, () => []);
  let up10 = 0, dn10 = 0;
  for (let k = 0; k < paths; k++) {
    let lp = 0, hi = 0, lo = 0;
    grid[0].push(p0);
    for (let t = 1; t <= days; t++) { lp += x[Math.floor(rnd() * x.length)]; grid[t].push(p0 * Math.exp(lp)); hi = Math.max(hi, lp); lo = Math.min(lo, lp); }
    if (hi >= Math.log(1.1)) up10++;
    if (lo <= Math.log(0.9)) dn10++;
  }
  const q = (a: number[], p: number) => { const z = [...a].sort((u, v) => u - v); return z[Math.min(z.length - 1, Math.floor(p * z.length))]; };
  const bands = grid.map((g) => [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => q(g, p)));
  const vol = Math.sqrt(r.reduce((a, v) => a + (v - mean) ** 2, 0) / r.length) * Math.sqrt(252);
  let peak = c[0], mdd = 0;
  for (const v of c) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  const sortedR = [...r].sort((a, b) => a - b);
  return { bands, p0, up10: up10 / paths, dn10: dn10 / paths, vol, mdd, worst: Math.exp(sortedR[0]) - 1, var95: Math.exp(sortedR[Math.floor(0.05 * sortedR.length)]) - 1, fromHigh: c[c.length - 1] / peak - 1 };
};
