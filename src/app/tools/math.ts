// Pure arithmetic behind the decision tools (tested in tests/tools.test.ts). No rounding here except whole shares.

/** Whole shares a stop allows: floor(capital × risk% ÷ (entry − stop)). Null when the inputs describe no long position. */
export function positionSize(capital: number, riskPct: number, entry: number, stop: number): { budget: number; perShare: number; qty: number } | null {
  if (!(capital > 0) || !(riskPct > 0) || riskPct > 100 || !(entry > 0) || !(stop > 0) || stop >= entry) return null;
  const budget = (capital * riskPct) / 100, perShare = entry - stop;
  return { budget, perShare, qty: Math.floor(budget / perShare) };
}

/** The loss on a long position if it exits below its stop: the open gaps `gapPct` below the stop, and `costPct` of the
 *  entry value is paid on the round trip. A gap of 0 is a fill exactly at the stop. Pure arithmetic, not a forecast. */
export function stressLoss(qty: number, entry: number, stop: number, gapPct: number, costPct: number): number {
  const exit = stop * (1 - gapPct / 100);
  return qty * (entry - exit) + qty * entry * (costPct / 100);
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

// ── Input checks (T04): every calculator says what is wrong with an input in words, never returns NaN or Infinity ──────
const fin = (n: number) => typeof n === 'number' && Number.isFinite(n);
export type Checked<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };
const fail = <T>(errors: Record<string, string>): Checked<T> => ({ ok: false, errors });

export interface PositionPlan {
  budget: number; perShare: number;
  /** Shares the risk budget allows. */
  byRisk: number;
  /** Shares the capital can pay for at the entry price. */
  byCapital: number;
  /** The size used: the smaller of the two. */
  qty: number;
  /** True when the capital, not the risk budget, set the size. */
  capped: boolean;
  /** The planned loss at the stop for `qty`, which is below the budget when capped. */
  loss: number;
}
/** Position size with every input checked, and capped at what the capital can buy (no leverage is assumed). */
export function positionPlan(capital: number, riskPct: number, entry: number, stop: number): Checked<PositionPlan> {
  const e: Record<string, string> = {};
  if (!fin(capital)) e.capital = 'Enter capital as a number.'; else if (capital <= 0) e.capital = 'Enter capital above ₹0.';
  if (!fin(riskPct)) e.risk = 'Enter risk per trade as a number.'; else if (riskPct <= 0) e.risk = 'Enter a risk above 0%.'; else if (riskPct > 100) e.risk = 'Risk cannot exceed 100% of capital.';
  if (!fin(entry)) e.entry = 'Enter the entry price as a number.'; else if (entry <= 0) e.entry = 'Enter an entry price above ₹0.';
  if (!fin(stop)) e.stop = 'Enter the stop price as a number.'; else if (stop <= 0) e.stop = 'Enter a stop price above ₹0.';
  else if (fin(entry) && entry > 0 && stop >= entry) e.stop = stop === entry ? 'A stop at the entry risks nothing per share, so no size follows. Put it below the entry.' : 'For a long position the stop sits below the entry. This tool does not size short positions.';
  if (Object.keys(e).length) return fail(e);
  const base = positionSize(capital, riskPct, entry, stop) as { budget: number; perShare: number; qty: number };
  const byCapital = Math.floor(capital / entry);
  const qty = Math.min(base.qty, byCapital);
  return { ok: true, value: { budget: base.budget, perShare: base.perShare, byRisk: base.qty, byCapital, qty, capped: byCapital < base.qty, loss: qty * base.perShare } };
}

/** CAGR with its inputs checked: a start or end at or below zero has no compound rate, and nor does a span of zero years. */
export function cagrPlan(from: number, to: number, years: number): Checked<{ rate: number; multiple: number }> {
  const e: Record<string, string> = {};
  if (!fin(from)) e.from = 'Enter the start value as a number.'; else if (from <= 0) e.from = 'A start above ₹0: from zero or below there is no rate.';
  if (!fin(to)) e.to = 'Enter the end value as a number.'; else if (to <= 0) e.to = 'An end above ₹0: a total loss has no meaningful rate.';
  if (!fin(years)) e.years = 'Enter years as a number.'; else if (years <= 0) e.years = 'Enter years above 0.'; else if (years > 60) e.years = 'Over 60 years a single rate says little.';
  if (Object.keys(e).length) return fail(e);
  const rate = cagr(from, to, years);
  return fin(rate) ? { ok: true, value: { rate, multiple: to / from } } : fail({ years: 'These values do not give a finite rate.' });
}

/** Recovery gain with the fall checked: 100% or more leaves nothing to recover. */
export function recoveryPlan(loss: number): Checked<number> {
  if (!fin(loss)) return fail({ loss: 'Enter the fall as a number.' });
  if (loss <= 0) return fail({ loss: 'Enter a fall above 0%. A rise needs no recovery.' });
  if (loss >= 100) return fail({ loss: 'A fall of 100% or more leaves nothing to recover.' });
  return { ok: true, value: recoveryGain(loss) };
}

/** Value of a growing earnings stream: `years` of growth at g, then a terminal value growing at tg forever (Gordon). */
export function dcfValue(eps: number, r: number, years: number, g: number, tg: number): number {
  let s = 0, e = eps;
  for (let t = 1; t <= years; t++) { e *= 1 + g; s += e / (1 + r) ** t; }
  return s + (e * (1 + tg) / (r - tg)) / (1 + r) ** years;
}
/** Reverse DCF inputs (in %): the terminal growth must be below the required return, or the terminal value is infinite or negative. */
export function dcfCheck(ratePct: number, terminalPct: number, years: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (!fin(ratePct)) e.rate = 'Enter the required return as a number.'; else if (ratePct <= 0) e.rate = 'Enter a required return above 0%.'; else if (ratePct > 50) e.rate = 'Up to 50% a year.';
  if (!fin(terminalPct)) e.terminal = 'Enter terminal growth as a number.'; else if (terminalPct < 0) e.terminal = 'Enter terminal growth of 0% or more.';
  else if (fin(ratePct) && ratePct > 0 && terminalPct >= ratePct) e.terminal = `Terminal growth must be below the required return (${ratePct}%): at or above it the value of the years after is infinite, so no growth rate can be solved.`;
  else if (terminalPct > 10) e.terminal = 'Up to 10%: no business outgrows the economy forever.';
  if (!fin(years)) e.years = 'Enter years as a number.'; else if (years < 1 || years > 30 || !Number.isInteger(years)) e.years = 'Enter whole years from 1 to 30.';
  return e;
}
/** The yearly growth for `years` that makes the discounted earnings equal today's price. Null when the inputs are invalid,
 *  EPS is not positive, or the answer lies outside −30% to 80% a year (bisection over that range). */
export function impliedGrowth(price: number, eps: number, r: number, years: number, tg: number): number | null {
  if (!fin(price) || !fin(eps) || !fin(r) || !fin(tg) || !fin(years) || price <= 0 || eps <= 0 || r <= 0 || tg >= r || years < 1) return null;
  const pv = (g: number) => dcfValue(eps, r, years, g, tg);
  let lo = -0.3, hi = 0.8;
  if (pv(lo) > price || pv(hi) < price) return null;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (pv(m) < price) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
