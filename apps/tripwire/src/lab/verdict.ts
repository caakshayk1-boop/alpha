/** What the Lab is allowed to say. The words are decided by numbers fixed here, before any strategy is run, and they get HARDER the more variants have been
 *  tried: testing twenty rules and showing the best is how every back-test looks good. A rule tried k times needs the t of a two-sided 5 percent test split k ways.
 *  k = 1 gives 2.0 (the bar the engines are held to), k = 8 gives 2.7 (the bar the Momentum family was held to). */
export function zQuantile(p: number): number {            // inverse normal CDF, Acklam's rational approximation (error under 1.2e-9)
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  const lo = 0.02425, hi = 1 - lo; let q: number, r: number;
  if (p < lo) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > hi) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
export const tRequired = (variantsTried: number) => Math.max(2.0, Math.round(zQuantile(1 - 0.05 / (2 * Math.max(1, variantsTried))) * 100) / 100);

export const MIN_TRADES = 30, MIN_HOLDOUT_TRADES = 10, HOLDOUT_FROM = '2023-01-01';
export interface Slice { n: number; meanNet: number | null; meanExcess: number | null; t: number | null; months: number }
export type Word = 'supported' | 'worked then stopped' | 'not supported' | 'too few trades';
export interface Verdict { word: Word; tNeeded: number; why: string }

export function judge(all: Slice, dev: Slice, hold: Slice, variantsTried: number): Verdict {
  const need = tRequired(variantsTried); const fmt = (x: number | null) => (x === null ? 'none' : x.toFixed(2));
  if (all.n < MIN_TRADES) return { word: 'too few trades', tNeeded: need, why: `${all.n} trades; at least ${MIN_TRADES} are needed before any figure means anything.` };
  const pass = (s: Slice) => s.meanExcess !== null && s.meanExcess > 0 && s.t !== null && s.t >= need;
  const holdOk = hold.n >= MIN_HOLDOUT_TRADES && hold.meanExcess !== null && hold.meanExcess > 0 && (hold.meanNet ?? -1) > 0;
  if (pass(all) && (all.meanNet ?? -1) > 0 && holdOk) return { word: 'supported', tNeeded: need, why: `Excess over the equal-weight universe is positive with t ${fmt(all.t)} (needed ${need} after ${variantsTried} ${variantsTried === 1 ? 'variant' : 'variants'} tried), net of costs, and still positive on the ${hold.n} trades from ${HOLDOUT_FROM}.` };
  if (pass(dev) && !holdOk) return { word: 'worked then stopped', tNeeded: need, why: `It cleared the bar before ${HOLDOUT_FROM} (t ${fmt(dev.t)}) but not since (${hold.n} trades, mean excess ${fmt(hold.meanExcess === null ? null : hold.meanExcess * 100)}%). A rule that stopped working is the usual shape of an overfitted one.` };
  return { word: 'not supported', tNeeded: need, why: `t ${fmt(all.t)} against the ${need} needed after ${variantsTried} ${variantsTried === 1 ? 'variant' : 'variants'} tried; mean excess ${all.meanExcess === null ? 'none' : (all.meanExcess * 100).toFixed(2) + '%'} a trade.` };
}
