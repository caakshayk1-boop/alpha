// Pure arithmetic behind the decision tools (tested in tests/tools.test.ts). No rounding here except whole shares.

/** Whole shares a stop allows: floor(capital × risk% ÷ (entry − stop)). Null when the inputs describe no long position. */
export function positionSize(capital: number, riskPct: number, entry: number, stop: number): { budget: number; perShare: number; qty: number } | null {
  if (!(capital > 0) || !(riskPct > 0) || riskPct > 100 || !(entry > 0) || !(stop > 0) || stop >= entry) return null;
  const budget = (capital * riskPct) / 100, perShare = entry - stop;
  return { budget, perShare, qty: Math.floor(budget / perShare) };
}

/** Expected R per trade and the win rate at which it is zero. */
export function expectancy(p: number, win: number, loss: number, cost: number) {
  return { ev: p * win - (1 - p) * loss - cost, breakEven: (loss + cost) / (win + loss) };
}

/** P(at least one run of k or more losses in n independent trades), exact, by tracking the current run length. */
export function streakProb(n: number, q: number, k: number): number {
  if (k <= 0) return 1;
  let st = new Array<number>(k).fill(0);
  st[0] = 1;
  let hit = 0;
  for (let t = 0; t < n; t++) {
    const nx = new Array<number>(k).fill(0);
    for (let s = 0; s < k; s++) {
      if (!st[s]) continue;
      nx[0] += st[s] * (1 - q);
      if (s + 1 >= k) hit += st[s] * q; else nx[s + 1] += st[s] * q;
    }
    st = nx;
  }
  return hit;
}

/** Exact 2.5% and 97.5% points of total R over n trades: the number of wins is binomial and total R rises with it. */
export function evBand(n: number, p: number, w: number, l: number, c: number): { lo: number; hi: number } {
  const lg: number[] = [0];
  for (let i = 1; i <= n; i++) lg[i] = lg[i - 1] + Math.log(i);
  const pmf = (k: number) => (p <= 0 ? (k === 0 ? 1 : 0) : p >= 1 ? (k === n ? 1 : 0) : Math.exp(lg[n] - lg[k] - lg[n - k] + k * Math.log(p) + (n - k) * Math.log(1 - p)));
  const tot = (k: number) => k * w - (n - k) * l - n * c;
  let acc = 0;
  let lo: number | null = null;
  let hi = tot(n);
  for (let k = 0; k <= n; k++) {
    acc += pmf(k);
    if (lo === null && acc >= 0.025) lo = tot(k);
    if (acc >= 0.975) { hi = tot(k); break; }
  }
  return { lo: lo ?? tot(0), hi };
}

/** The gain that undoes a fall of `loss`%. */
export const recoveryGain = (loss: number) => (loss / (100 - loss)) * 100;

/** Compound annual rate, in %, from a start value to an end value over `years`. */
export const cagr = (from: number, to: number, years: number) => (Math.pow(to / from, 1 / years) - 1) * 100;
